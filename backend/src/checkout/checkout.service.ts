import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, ReceiverNetwork, Transaction } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { CheckoutInitDto, SmsWebhookDto } from './dto';
import { activeReceivers, isKnownActiveReceiver, normalizePhone } from './receivers';
import { parseSms, isTrustedSmsSender } from './sms-parser';

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
   * SMS BRUT relayé par le téléphone Listener (app de transfert SMS → HTTP).
   * Applique les barrières anti-falsification avant toute validation :
   *  (1) token appareil        → garde du controller
   *  (2) expéditeur officiel   → isTrustedSmsSender (jamais un numéro ordinaire)
   *  (3) référence unique      → anti-rejeu du même reçu
   *  (4) continuité du solde   → ancien_solde + montant = nouveau_solde (décisive :
   *      un faussaire ne connaît pas le solde exact de la puce)
   *  (5) concordance stricte   → déléguée à reconcile()
   */
  async ingestRawSms(params: { text: string; from?: string; receiverPhone: string }) {
    const receiverPhone = normalizePhone(params.receiverPhone);
    const account = activeReceivers().find((r) => r.phone === receiverPhone);
    if (!account) return { ok: true, accepted: false, reason: 'unknown_receiver' };

    // (2) L'expéditeur doit être l'identifiant officiel de l'opérateur.
    if (!isTrustedSmsSender(params.from)) {
      this.logger.warn(`SMS rejeté : expéditeur non officiel (${params.from ?? 'inconnu'}).`);
      return { ok: true, accepted: false, reason: 'untrusted_sender' };
    }

    const parsed = parseSms(params.text);
    if (!parsed) return { ok: true, accepted: false, reason: 'unparsable' };

    // (4a) Toujours mettre à jour le solde connu — y compris sur les retraits/débits —
    // sinon la chaîne se désynchronise et les vrais paiements seraient rejetés à tort.
    const state = await this.prisma.simState.findUnique({ where: { receiverPhone } });
    const previousBalance = state?.lastBalance != null ? Number(state.lastBalance) : null;
    if (parsed.newBalance != null) {
      await this.prisma.simState.upsert({
        where: { receiverPhone },
        update: { lastBalance: parsed.newBalance, lastReference: parsed.reference ?? undefined },
        create: { receiverPhone, lastBalance: parsed.newBalance, lastReference: parsed.reference ?? null },
      });
    }

    // Un débit (retrait) ne valide jamais un paiement : il ne sert qu'au suivi du solde.
    if (!parsed.isCredit || !parsed.amount || !parsed.senderPhone) {
      return { ok: true, accepted: false, reason: 'not_a_credit' };
    }

    // (3) Anti-rejeu : cette référence opérateur a-t-elle déjà été traitée ?
    if (parsed.reference) {
      const seen = await this.prisma.inboundSms.findFirst({ where: { txId: parsed.reference } });
      if (seen) return { ok: true, accepted: false, reason: 'duplicate_reference' };
    }

    // (4b) Continuité du solde : la barrière décisive.
    // Première fois (aucun solde connu) → on amorce la chaîne sans bloquer.
    // Vérification EXACTE au centime : ce sont justement les décimales du solde
    // (ex. « 7 280,69 ») qu'un faussaire ne peut pas deviner. Une tolérance large
    // (même 1 FCFA) suffirait à laisser passer un solde arrondi inventé.
    const balanceOk =
      previousBalance == null || parsed.newBalance == null
        ? true
        : Math.abs(previousBalance + parsed.amount - parsed.newBalance) < 0.01; // marge flottants seulement

    if (!balanceOk) {
      // On NE valide PAS automatiquement : on archive pour vérification manuelle.
      await this.prisma.inboundSms.create({
        data: {
          txId: parsed.reference, amount: parsed.amount, senderPhone: parsed.senderPhone,
          receiverNetwork: account.network, receiverPhone, raw: params.text.slice(0, 500),
          newBalance: parsed.newBalance ?? undefined, balanceOk: false, consumed: false,
        },
      });
      this.logger.warn(
        `SMS suspect (solde incohérent) : attendu ${previousBalance! + parsed.amount}, reçu ${parsed.newBalance}. ` +
          `Aucune validation automatique — vérification manuelle requise.`,
      );
      return { ok: true, accepted: false, reason: 'balance_mismatch' };
    }

    // (5) Concordance stricte + validation, via le moteur existant.
    const r = await this.reconcile({
      txId: parsed.reference ?? undefined,
      amount: parsed.amount,
      senderPhone: parsed.senderPhone,
      receiverNetwork: account.network,
      receiverPhone,
      raw: params.text.slice(0, 500),
    });
    return { ok: true, accepted: true, ...r };
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
