import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, ReceiverNetwork, Transaction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { CheckoutInitDto, SmsWebhookDto } from './dto';
import { activeReceivers, isKnownActiveReceiver, normalizePhone } from './receivers';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
    private notifications: NotificationsService,
    private payments: PaymentsService,
  ) {}

  /** Liste des puces actives (le front y choisit le numéro à afficher, par réseau). */
  receivers() {
    return activeReceivers().map((r) => ({ network: r.network, phone: r.phone, label: r.label }));
  }

  /**
   * POST /api/checkout/init — le client a déjà envoyé l'argent et déclare son envoi.
   * On crée une transaction `pending`. Si un SMS de réception concordant est DÉJÀ arrivé
   * (cas « SMS avant clic »), on valide immédiatement en le consommant.
   */
  async init(userId: string, dto: CheckoutInitDto) {
    if (!isKnownActiveReceiver(dto.receiverNetwork, dto.receiverPhone)) {
      throw new BadRequestException('Numéro de réception inconnu ou désactivé.');
    }
    const amount =
      dto.purpose === 'gold_subscription'
        ? await this.payments.goldPriceFor(userId)
        : Number(dto.amount);
    if (!(amount > 0)) throw new BadRequestException('Montant invalide.');

    const receiverPhone = normalizePhone(dto.receiverPhone);
    const senderPhone = normalizePhone(dto.senderPhone);

    const tx = await this.prisma.transaction.create({
      data: {
        txId: dto.txId?.trim() || null,
        amount,
        senderPhone,
        senderName: dto.senderName?.trim() || null,
        receiverNetwork: dto.receiverNetwork,
        receiverPhone,
        purpose: dto.purpose,
        userId,
        status: 'pending',
      },
    });

    // Réconciliation différée : un SMS concordant est-il déjà en réserve ?
    const orphan = await this.prisma.inboundSms.findFirst({
      where: {
        consumed: false,
        receiverPhone,
        senderPhone,
        amount: new Prisma.Decimal(amount),
        receiverNetwork: dto.receiverNetwork,
      },
      orderBy: { receivedAt: 'asc' },
    });
    if (orphan) {
      await this.prisma.inboundSms.update({ where: { id: orphan.id }, data: { consumed: true } });
      await this.complete(tx, orphan.txId ?? undefined);
      return { id: tx.id, status: 'completed', amount };
    }

    return { id: tx.id, status: tx.status, amount };
  }

  /** Polling client : état de SA transaction (contrôle d'appartenance). */
  async status(userId: string, id: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx || tx.userId !== userId) throw new NotFoundException('Transaction introuvable.');
    return { status: tx.status };
  }

  /**
   * POST /api/checkout/webhook/sms — moteur de réconciliation (téléphone Listener).
   * ANCRE = numéro expéditeur + montant + puce réceptrice (identiques des deux côtés,
   * contrairement au TxID). Anti-replay atomique. Aucun paiement validé sans concordance.
   */
  async reconcile(dto: SmsWebhookDto) {
    if (!isKnownActiveReceiver(dto.receiverNetwork, dto.receiverPhone)) {
      return { matched: false, reason: 'unknown_receiver' };
    }
    const receiverPhone = normalizePhone(dto.receiverPhone);
    const senderPhone = normalizePhone(dto.senderPhone);
    const amount = new Prisma.Decimal(dto.amount);

    // La plus ancienne transaction pending qui correspond exactement.
    const tx = await this.prisma.transaction.findFirst({
      where: { status: 'pending', receiverPhone, senderPhone, amount, receiverNetwork: dto.receiverNetwork },
      orderBy: { createdAt: 'asc' },
    });

    // Aucune correspondance : SMS arrivé avant l'init client (ou paiement non déclaré).
    // On le met en réserve pour réconciliation différée (consommé au prochain init concordant).
    if (!tx) {
      await this.prisma.inboundSms.create({
        data: {
          txId: dto.txId?.trim() || null,
          amount,
          senderPhone,
          receiverNetwork: dto.receiverNetwork,
          receiverPhone,
          raw: dto.raw?.slice(0, 500) || null,
        },
      });
      this.logger.log(`SMS sans transaction pending → mis en réserve (exp=${senderPhone}, montant=${dto.amount}).`);
      return { matched: false, reason: 'stored_for_later' };
    }

    await this.complete(tx, dto.txId);
    return { matched: true, status: 'completed' };
  }

  /**
   * Validation atomique + déblocage du produit. La garde `status: 'pending'` dans le
   * updateMany empêche toute double-exécution concurrente (anti-replay) : si une autre
   * requête a déjà validé cette transaction, `count === 0` et on ne rejoue rien.
   */
  private async complete(tx: Transaction, smsTxId?: string) {
    const res = await this.prisma.transaction.updateMany({
      where: { id: tx.id, status: 'pending' },
      data: { status: 'completed', completedAt: new Date(), ...(smsTxId ? { txId: smsTxId } : {}) },
    });
    if (res.count === 0) return; // déjà traitée par une exécution concurrente

    const amount = Number(tx.amount);
    // Activation mutualisée avec la voie FedaPay (option a).
    if (tx.purpose === 'gold_subscription') {
      await this.payments.applyGoldActivation(tx.userId, amount);
      await this.notifications.notify(tx.userId, '✅ Ton Pack Gold est activé. Bienvenue !', 'success');
    } else {
      await this.payments.creditInvestorDeposit(tx.userId, amount, `Mobile Money ${tx.senderPhone}`);
      await this.notifications.notify(
        tx.userId,
        `✅ Ton dépôt de ${amount.toLocaleString('fr-FR')} FCFA a bien été reçu et placé « sous analyse ».`,
        'success',
      );
    }

    // Débloque INSTANTANÉMENT le front du client (il poll /status).
    this.realtime.emit({ type: 'transaction.completed', data: { id: tx.id, userId: tx.userId } });
    this.logger.log(`Transaction ${tx.id} (${tx.purpose}) validée pour user ${tx.userId}.`);
  }
}
