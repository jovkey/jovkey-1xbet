import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { FedapayService } from './fedapay.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RechargeDto } from '../auth/dto';

const RENEWAL_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

const GOLD_DEFAULT_XOF = 5600;
const GOLD_SUBSCRIPTION_DAYS = 30;
const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
    private fedapay: FedapayService,
    private notifications: NotificationsService,
  ) {}

  private currentCycle(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private async baseGoldPrice(): Promise<number> {
    const s = await this.prisma.cmsSetting.findUnique({ where: { key: 'gold_price' } });
    const amount = Number((s?.value as { amount?: number } | null)?.amount);
    return amount > 0 ? amount : GOLD_DEFAULT_XOF;
  }

  /**
   * Prix Gold pour CE membre : moitié prix pour un ANCIEN abonné qui renouvelle
   * (subscriptionEndsAt déjà défini = a déjà eu au moins un cycle payé), plein tarif
   * pour un tout premier abonnement — incitation automatique au réengagement (§12).
   */
  private async goldPriceFor(userId: string): Promise<number> {
    const base = await this.baseGoldPrice();
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { subscriptionEndsAt: true } });
    const isRenewal = !!user?.subscriptionEndsAt;
    return isRenewal ? Math.round(base / 2) : base;
  }

  /**
   * Démarre un paiement FedaPay (Gold ou recharge investisseur).
   * Renvoie l'URL de checkout vers laquelle rediriger le client.
   */
  async initFedapay(
    userId: string,
    purpose: 'gold_subscription' | 'investor_deposit',
    amount?: number,
    customer?: { name?: string; email?: string; phone?: string },
  ) {
    const value = purpose === 'gold_subscription' ? await this.goldPriceFor(userId) : Math.max(1, Number(amount) || 0);
    if (purpose === 'investor_deposit' && value < 1) {
      throw new BadRequestException('Montant de recharge invalide.');
    }
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        amount: value,
        currency: 'XOF',
        method: 'other',
        purpose,
        status: 'pending',
      },
    });
    // La recharge investisseur entre en « sous analyse » jusqu'à confirmation du paiement.
    if (purpose === 'investor_deposit') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { balanceUnderAnalysis: { increment: value } },
      });
    }
    const desc = purpose === 'gold_subscription' ? 'Abonnement Pack Gold - Jovkey' : 'Recharge capital investisseur JOVKEY';
    const { paymentUrl, providerTxId } = await this.fedapay.initPayment({
      paymentId: payment.id,
      amount: value,
      description: desc,
      customer,
    });
    await this.prisma.payment.update({ where: { id: payment.id }, data: { checkoutUrl: paymentUrl, providerTxId } });
    return { paymentId: payment.id, paymentUrl, mode: this.fedapay.mode };
  }

  /** Génère (et persiste) un token de renouvellement à usage unique pour un membre Gold. */
  async generateRenewalToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: userId },
      data: { renewalToken: token, renewalTokenExpiresAt: new Date(Date.now() + RENEWAL_TOKEN_TTL_MS) },
    });
    return token;
  }

  /**
   * Renouvellement Gold "1 clic" depuis le lien reçu par email — pas besoin d'être
   * connecté. FedaPay n'offrant pas de prélèvement automatique récurrent (vérifié dans
   * leur doc API), c'est l'approximation la plus honnête : un lien pré-rempli, le client
   * n'a plus qu'à confirmer son paiement mobile money/carte, sans ressaisir aucune info.
   */
  async renewGoldByToken(token: string) {
    const user = await this.prisma.user.findUnique({ where: { renewalToken: token } });
    if (!user || !user.renewalTokenExpiresAt || user.renewalTokenExpiresAt < new Date()) {
      throw new NotFoundException('Lien de renouvellement invalide ou expiré.');
    }
    // À usage unique : on invalide le token tout de suite pour empêcher toute réutilisation
    // (lien transféré, email ouvert deux fois…) avant même de créer la transaction.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { renewalToken: null, renewalTokenExpiresAt: null },
    });
    return this.initFedapay(user.id, 'gold_subscription', undefined, { email: user.email ?? undefined });
  }

  /** Confirme un paiement FedaPay (webhook / retour / simulation) : active ou rejette, idempotent. */
  async confirmFedapay(providerTxId: string, accepted: boolean) {
    const payment = await this.prisma.payment.findUnique({ where: { providerTxId } });
    if (!payment) throw new NotFoundException('Transaction inconnue');
    if (payment.status !== 'pending') {
      return { ok: true, status: payment.status, alreadyProcessed: true };
    }
    if (accepted) {
      await this.validate(payment.id);
      return { ok: true, status: 'validated' };
    }
    await this.reject(payment.id);
    return { ok: true, status: 'rejected' };
  }

  /** Webhook FedaPay : on revérifie le statut réel via l'API (jamais confiance au seul body reçu), puis on confirme (idempotent). */
  async fedapayNotify(providerTxId: string) {
    const status = await this.fedapay.verify(providerTxId);
    if (status === 'approved') return this.confirmFedapay(providerTxId, true);
    if (status === 'declined' || status === 'canceled') return this.confirmFedapay(providerTxId, false);
    return { ok: true, status: 'pending' };
  }

  /** Investisseur : déclare une recharge de capital → solde « sous analyse ». */
  async recharge(userId: string, dto: RechargeDto) {
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        amount: dto.amount,
        currency: 'XOF',
        method: dto.method,
        purpose: 'investor_deposit',
        status: 'pending',
        reference: dto.reference.trim(),
      },
    });
    // L'argent déclaré entre en « sous analyse » tant que l'admin ne valide pas.
    await this.prisma.user.update({
      where: { id: userId },
      data: { balanceUnderAnalysis: { increment: dto.amount } },
    });
    this.realtime.emit({ type: 'payment.new', data: { userId, purpose: 'investor_deposit' } });
    return {
      ok: true,
      paymentId: payment.id,
      message:
        'Recharge enregistrée et placée « sous analyse ». ' +
        'Elle sera investie dès validation de votre paiement par l’administration.',
    };
  }

  mine(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Admin : file des paiements en attente à arbitrer manuellement.
   * Uniquement les recharges investisseur (l'admin choisit qui est investi ce mois-ci,
   * cf. §3 : sélection/rejet du capital). L'abonnement Gold, lui, est validé
   * AUTOMATIQUEMENT par le webhook FedaPay dès que le paiement est confirmé — il
   * n'apparaît donc jamais dans cette file et n'a besoin d'aucune action admin.
   */
  listPending() {
    return this.prisma.payment.findMany({
      where: { status: 'pending', purpose: 'investor_deposit' },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id1xbet: true, whatsappNum: true, role: true, country: true } } },
    });
  }

  /**
   * Vérifie l'état réel d'un paiement auprès de FedaPay (filet de sécurité si le webhook
   * n'a pas pu être délivré, ex. tunnel local coupé). Appelé par la page de retour
   * du client : permet une activation automatique même sans réception du webhook.
   */
  async checkStatus(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Paiement introuvable');
    if (payment.status !== 'pending' || !payment.providerTxId || payment.providerTxId.startsWith('SIM-')) {
      return { status: payment.status, purpose: payment.purpose };
    }
    const remoteStatus = await this.fedapay.verify(payment.providerTxId);
    if (remoteStatus === 'approved') {
      await this.confirmFedapay(payment.providerTxId, true);
      return { status: 'validated', purpose: payment.purpose };
    }
    if (remoteStatus === 'declined' || remoteStatus === 'canceled') {
      await this.confirmFedapay(payment.providerTxId, false);
      return { status: 'rejected', purpose: payment.purpose };
    }
    return { status: 'pending', purpose: payment.purpose };
  }

  /**
   * Admin valide un paiement.
   * - Gold : active le compte.
   * - Investisseur : déplace le montant de « sous analyse » vers « gelé »
   *   (investi pour 1 mois) et crée la ligne d'investissement du cycle.
   */
  async validate(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Paiement introuvable');
    if (payment.status !== 'pending') {
      throw new BadRequestException('Paiement déjà traité.');
    }
    const amount = Number(payment.amount);

    if (payment.purpose === 'gold_subscription') {
      const user = await this.prisma.user.findUnique({ where: { id: payment.userId } });
      // Renouvellement : +30 jours à partir de la fin d'abonnement courante si elle n'est pas
      // encore expirée (renouvellement anticipé), sinon à partir de maintenant.
      const base = user?.subscriptionEndsAt && user.subscriptionEndsAt > new Date() ? user.subscriptionEndsAt : new Date();
      const subscriptionEndsAt = new Date(base.getTime() + GOLD_SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);

      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id },
          data: { status: 'validated', reviewedAt: new Date() },
        }),
        this.prisma.user.update({
          where: { id: payment.userId },
          data: { accountStatus: 'active', subscriptionEndsAt },
        }),
      ]);
    } else {
      // investor_deposit : sous analyse → gelé + investissement actif
      const cycle = this.currentCycle();
      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id },
          data: { status: 'validated', reviewedAt: new Date() },
        }),
        this.prisma.user.update({
          where: { id: payment.userId },
          data: {
            balanceUnderAnalysis: { decrement: amount },
            balanceFrozen: { increment: amount },
            lastInvestmentDate: new Date(),
          },
        }),
        this.prisma.investment.create({
          data: { userId: payment.userId, capital: amount, cycleMonth: cycle, status: 'active' },
        }),
      ]);
      await this.notifications.notify(
        payment.userId,
        `✅ Ton dépôt de ${fmt(amount)} a été accepté et est maintenant en gestion par notre équipe pour ce cycle.`,
        'success',
      );
    }

    this.realtime.emit({ type: 'payment.validated', data: { id } });
    return { ok: true, status: 'validated' };
  }

  /**
   * Admin refuse un paiement.
   * - Gold : le compte reste en attente de paiement.
   * - Investisseur : le montant « sous analyse » devient « retirable »
   *   (le client peut le récupérer, cf. cahier des charges).
   */
  async reject(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Paiement introuvable');
    if (payment.status !== 'pending') {
      throw new BadRequestException('Paiement déjà traité.');
    }
    const amount = Number(payment.amount);

    if (payment.purpose === 'investor_deposit') {
      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id },
          data: { status: 'rejected', reviewedAt: new Date() },
        }),
        this.prisma.user.update({
          where: { id: payment.userId },
          data: {
            balanceUnderAnalysis: { decrement: amount },
            balanceWithdrawable: { increment: amount },
          },
        }),
      ]);
      await this.notifications.notify(
        payment.userId,
        `⏳ Ton dépôt de ${fmt(amount)} n'a pas été retenu ce mois-ci (équipe déjà complète). ` +
          `Tu peux le retirer dès maintenant, ou le laisser sur ton solde retirable pour investir ` +
          `dès le mois prochain et sécuriser ta place.`,
        'warning',
      );
    } else {
      await this.prisma.payment.update({
        where: { id },
        data: { status: 'rejected', reviewedAt: new Date() },
      });
    }

    this.realtime.emit({ type: 'payment.rejected', data: { id } });
    return { ok: true, status: 'rejected' };
  }
}
