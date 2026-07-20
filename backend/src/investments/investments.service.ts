import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WithdrawalDto } from '../auth/dto';

const MONTHLY_INVESTOR_QUOTA = 30;
const REVIEWS_REQUIRED = 5;
const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

@Injectable()
export class InvestmentsService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
    private notifications: NotificationsService,
  ) {}

  private currentCycle(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  async dashboard(userId: string) {
    const cycle = this.currentCycle();
    const [user, investments, points, reviewsWritten, payments, withdrawals] =
      await Promise.all([
        this.prisma.user.findUnique({ where: { id: userId } }),
        this.prisma.investment.findMany({ where: { userId, cycleMonth: cycle } }),
        this.prisma.performancePoint.findMany({
          where: { cycleMonth: cycle },
          orderBy: { day: 'asc' },
        }),
        this.prisma.review.count({ where: { userId } }),
        this.prisma.payment.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        this.prisma.withdrawal.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
      ]);
    if (!user) throw new NotFoundException('Compte introuvable');

    const balances = {
      withdrawable: Number(user.balanceWithdrawable),
      underAnalysis: Number(user.balanceUnderAnalysis),
      frozen: Number(user.balanceFrozen),
    };
    const pnl = investments.reduce((sum, i) => sum + Number(i.pnl), 0);
    const capital = balances.frozen;

    return {
      cycleMonth: cycle,
      currency: 'XOF',
      balances,
      capital,
      pnl,
      roiPct: capital > 0 ? Number(((pnl / capital) * 100).toFixed(2)) : 0,
      performance: points.map((p) => ({ day: p.day, value: p.bankrollPct })),
      reviewsGate: {
        written: reviewsWritten,
        required: REVIEWS_REQUIRED,
        unlocked: reviewsWritten >= REVIEWS_REQUIRED,
      },
      payments,
      withdrawals,
    };
  }

  /**
   * Demande de retrait : exige 5 avis + un solde « retirable » suffisant.
   * Le montant est immédiatement réservé (déduit du retirable) et la demande
   * reste « en attente » jusqu'à validation de l'admin.
   */
  async requestWithdrawal(userId: string, dto: WithdrawalDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Compte introuvable');

    const reviewsWritten = await this.prisma.review.count({ where: { userId } });
    if (reviewsWritten < REVIEWS_REQUIRED) {
      throw new ForbiddenException(
        `Retrait verrouillé : ${reviewsWritten}/${REVIEWS_REQUIRED} avis constructifs requis.`,
      );
    }
    if (dto.amount > Number(user.balanceWithdrawable)) {
      throw new BadRequestException('Montant supérieur au solde retirable.');
    }

    const [withdrawal] = await this.prisma.$transaction([
      this.prisma.withdrawal.create({
        data: {
          userId,
          amount: dto.amount,
          method: dto.method,
          destination: dto.destination.trim(),
          status: 'pending',
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { balanceWithdrawable: { decrement: dto.amount } },
      }),
    ]);

    this.realtime.emit({ type: 'withdrawal.new', data: { id: withdrawal.id } });
    return {
      ok: true,
      withdrawalId: withdrawal.id,
      message: 'Demande de retrait enregistrée. Validation par l’administration avant versement.',
    };
  }

  /**
   * Admin : investisseurs avec un capital actif (gelé) sur le cycle en cours — sert
   * l'outil de versement de fin de mois (onglet Retraits). Un même client peut avoir
   * plusieurs dépôts validés dans le mois ; on regroupe par client, une seule ligne.
   */
  async activeThisCycle() {
    const cycle = this.currentCycle();
    const investments = await this.prisma.investment.findMany({
      where: { cycleMonth: cycle, status: 'active' },
      include: { user: { select: { id: true, email: true, id1xbet: true, balanceFrozen: true } } },
    });
    const byUser = new Map<string, { userId: string; email: string | null; id1xbet: string | null; capital: number; balanceFrozen: number }>();
    for (const inv of investments) {
      const existing = byUser.get(inv.userId);
      const capital = Number(inv.capital);
      if (existing) existing.capital += capital;
      else {
        byUser.set(inv.userId, {
          userId: inv.userId,
          email: inv.user.email,
          id1xbet: inv.user.id1xbet,
          capital,
          balanceFrozen: Number(inv.user.balanceFrozen),
        });
      }
    }
    return Array.from(byUser.values());
  }

  /** Admin : retraits en attente. */
  listWithdrawals() {
    return this.prisma.withdrawal.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id1xbet: true, whatsappNum: true, country: true } } },
    });
  }

  /** Admin : valide et marque le retrait comme versé (montant déjà réservé). */
  async validateWithdrawal(id: string) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Retrait introuvable');
    if (w.status !== 'pending') throw new BadRequestException('Retrait déjà traité.');
    await this.prisma.withdrawal.update({
      where: { id },
      data: { status: 'paid', reviewedAt: new Date() },
    });
    await this.notifications.notify(
      w.userId,
      `💸 Ton retrait de ${fmt(Number(w.amount))} a été versé.`,
      'success',
    );
    this.realtime.emit({ type: 'withdrawal.paid', data: { id } });
    return { ok: true, status: 'paid' };
  }

  /** Admin : refuse → le montant réservé est rendu au solde retirable. */
  async rejectWithdrawal(id: string) {
    const w = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!w) throw new NotFoundException('Retrait introuvable');
    if (w.status !== 'pending') throw new BadRequestException('Retrait déjà traité.');
    await this.prisma.$transaction([
      this.prisma.withdrawal.update({
        where: { id },
        data: { status: 'rejected', reviewedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: w.userId },
        data: { balanceWithdrawable: { increment: Number(w.amount) } },
      }),
    ]);
    await this.notifications.notify(
      w.userId,
      `Ta demande de retrait de ${fmt(Number(w.amount))} a été refusée. Le montant reste disponible sur ton solde retirable.`,
      'warning',
    );
    this.realtime.emit({ type: 'withdrawal.rejected', data: { id } });
    return { ok: true, status: 'rejected' };
  }

  /**
   * Admin : libère un capital « gelé » (fin de cycle) vers le « retirable »,
   * en y ajoutant le gain réalisé. C'est l'étape « après 1 mois, gain disponible ».
   */
  async releaseFrozen(userId: string, amount: number, gain: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Compte introuvable');
    if (amount > Number(user.balanceFrozen)) {
      throw new BadRequestException('Montant supérieur au solde gelé.');
    }
    const total = amount + (gain || 0);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        balanceFrozen: { decrement: amount },
        balanceWithdrawable: { increment: total },
      },
    });
    const gainMsg = gain > 0 ? ` (capital ${fmt(amount)} + gain ${fmt(gain)})` : '';
    await this.notifications.notify(
      userId,
      `💰 Ton capital est libéré : ${fmt(total)}${gainMsg} disponible sur ton solde retirable !`,
      'success',
    );
    this.realtime.emit({ type: 'balance.released', data: { userId } });
    return { ok: true, released: total };
  }

  /**
   * §4A — Si le quota d'investisseurs du mois n'est pas atteint, on repêche les
   * anciens investisseurs triés par last_investment_date la plus ancienne.
   */
  async runElasticity() {
    const cycle = this.currentCycle();
    const activeThisCycle = await this.prisma.investment.count({
      where: { cycleMonth: cycle, status: 'active' },
    });
    const vacantSlots = MONTHLY_INVESTOR_QUOTA - activeThisCycle;
    if (vacantSlots <= 0) {
      return { vacantSlots: 0, repechaged: [], message: 'Quota déjà rempli.' };
    }

    const candidates = await this.prisma.user.findMany({
      where: { role: 'investor' },
      orderBy: { lastInvestmentDate: 'asc' }, // les plus anciens d'abord
      take: vacantSlots,
    });

    await this.prisma.user.updateMany({
      where: { id: { in: candidates.map((c) => c.id) } },
      data: { eligibleForReinvest: true },
    });

    return {
      vacantSlots,
      repechaged: candidates.map((c) => ({ id: c.id, id1xbet: c.id1xbet })),
      message: `${candidates.length} investisseur(s) marqué(s) éligibles au repêchage prioritaire.`,
    };
  }

  // ── Prospects investisseurs ────────────────────────────────────────
  /** Enregistre l'intérêt d'un investisseur (rien n'est perdu) + prévient l'admin en direct. */
  async createContactLead(userId: string, contact?: string, note?: string) {
    const lead = await this.prisma.investorLead.create({
      data: { userId, contact: contact?.trim() || null, note: note?.trim() || null, status: 'new' },
    });
    this.realtime.emit({ type: 'investor.lead', data: { id: lead.id } });
    return { ok: true, id: lead.id };
  }

  /** Admin : liste des prospects, avec l'identité du membre (ID 1xBet, WhatsApp, email). */
  listLeads() {
    return this.prisma.investorLead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: { user: { select: { id1xbet: true, whatsappNum: true, email: true, country: true } } },
    });
  }

  async setLeadStatus(id: string, status: string) {
    const allowed = ['new', 'contacted', 'done'];
    if (!allowed.includes(status)) throw new BadRequestException('Statut invalide.');
    await this.prisma.investorLead.update({ where: { id }, data: { status } });
    return { ok: true };
  }
}
