import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { IngestPredictionDto } from './predictions.controller';

@Injectable()
export class PredictionsService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
  ) {}

  /** Une seule cote ~2 gratuite, validée, la plus récente. */
  freeOfTheDay() {
    return this.prisma.prediction.findFirst({
      where: { tier: 'free', isValidated: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Flux privé. Un Gold dont l'abonnement est expiré reste connecté (§12) mais son
   * flux est VERROUILLÉ : on renvoie les pronostics SANS couponCode (juste le teasing —
   * sport, cote, fiabilité) plus un message de renouvellement convaincant, plutôt que
   * de bloquer purement et simplement l'accès à la page.
   */
  async privateFeed(role: 'gold' | 'investor', subscriptionEndsAt: Date | null) {
    const items = await this.prisma.prediction.findMany({
      where: { tier: { in: ['gold', 'investor'] }, isValidated: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const locked = role === 'gold' && !!subscriptionEndsAt && subscriptionEndsAt < new Date();
    if (!locked) return { locked: false, items };
    return {
      locked: true,
      message:
        "Ton abonnement Gold est arrivé à échéance. D'excellentes cotes précises sont disponibles " +
        "aujourd'hui — renouvelle maintenant pour débloquer immédiatement tes coupons et ne rien manquer.",
      items: items.map((p) => ({ ...p, couponCode: '' })),
    };
  }

  pending() {
    return this.prisma.prediction.findMany({
      where: { isValidated: false },
      orderBy: { valueScore: 'desc' },
    });
  }

  /** Vue admin : toutes les prédictions (brut IA inclus), les plus récentes d'abord. */
  adminList() {
    return this.prisma.prediction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async validate(id: string) {
    const p = await this.prisma.prediction.update({ where: { id }, data: { isValidated: true } });
    this.realtime.emit({ type: 'prediction.new', data: { tier: p.tier, market: p.market } });
    return p;
  }

  /**
   * Publication manuelle par l'admin : place la prédiction sur un canal
   * (free = ticket gratuit cote 2 / gold = flux privé), avec le code coupon 1xBet,
   * et la valide d'un coup (visible immédiatement côté public ou Gold).
   */
  async publish(id: string, tier: 'free' | 'gold' | 'investor', couponCode?: string) {
    const p = await this.prisma.prediction.update({
      where: { id },
      data: {
        tier,
        isValidated: true,
        ...(couponCode ? { couponCode: couponCode.trim() } : {}),
      },
    });
    this.realtime.emit({ type: 'prediction.new', data: { tier: p.tier, market: p.market } });
    return p;
  }

  /**
   * Pronostics à noter : en attente, rattachés à un match (extMatchId).
   * Permet au moteur de noter depuis la BASE, sans fichier local — donc même
   * après redémarrage / en ligne, les résultats finissent toujours par s'enregistrer.
   */
  pendingGrading() {
    return this.prisma.prediction.findMany({
      where: { result: 'pending', extMatchId: { not: null } },
      select: { id: true, extMatchId: true, gradeType: true, market: true, match: true, eventDate: true },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
  }

  /** Notation d'une prédiction (par le moteur) : won / lost / void. */
  async setResult(id: string, result: 'won' | 'lost' | 'void', note?: string) {
    const p = await this.prisma.prediction.update({
      where: { id },
      data: { result, resultNote: note ?? null, playedAt: new Date() },
    });
    this.realtime.emit({ type: 'prediction.result', data: { id, result } });
    return { ok: true, id: p.id, result: p.result };
  }

  /** Taux de réussite : global, par marché, par sport (matchs déjà notés). */
  async performance() {
    const graded = await this.prisma.prediction.findMany({
      where: { result: { in: ['won', 'lost'] } },
    });
    const pending = await this.prisma.prediction.count({ where: { result: 'pending' } });

    const tally = (key: (p: (typeof graded)[number]) => string) => {
      const map: Record<string, { won: number; total: number }> = {};
      for (const p of graded) {
        const k = key(p);
        map[k] ??= { won: 0, total: 0 };
        map[k].total++;
        if (p.result === 'won') map[k].won++;
      }
      return Object.entries(map)
        .map(([k, v]) => ({ key: k, won: v.won, total: v.total, rate: Math.round((v.won / v.total) * 100) }))
        .sort((a, b) => b.total - a.total);
    };

    const won = graded.filter((p) => p.result === 'won').length;
    const total = graded.length;
    return {
      overall: { won, total, pending, rate: total ? Math.round((won / total) * 100) : 0 },
      byMarket: tally((p) => p.market),
      bySport: tally((p) => p.sport),
    };
  }

  /**
   * Le moteur Python pousse une opportunité détectée par l'algorithme anti-piège.
   * Une cote ~2 part en "free" non validée (attente admin) ; les cotes agressives
   * validées mathématiquement vont directement au flux privé.
   */
  async ingest(dto: IngestPredictionDto) {
    // Idempotence : un même match (extMatchId réel) ne doit jamais être déposé deux fois,
    // même si le moteur repasse dessus (re-vérification du matin après le passage de minuit,
    // relance manuelle…). Sans ce garde-fou, chaque repassage créerait un doublon en base.
    if (dto.extMatchId) {
      const existing = await this.prisma.prediction.findFirst({ where: { extMatchId: dto.extMatchId } });
      if (existing) return existing;
    }
    const tier = dto.tier ?? (dto.odds <= 2.2 ? 'free' : 'gold');
    const p = await this.prisma.prediction.create({
      data: {
        sport: dto.sport,
        match: dto.match,
        market: dto.market,
        selection: dto.selection,
        odds: dto.odds,
        reliability: dto.reliability,
        couponCode: dto.couponCode ?? '', // l'IA n'en met jamais ; l'admin l'ajoutera
        valueScore: dto.valueScore,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        analysis: (dto.analysis ?? undefined) as any, // données brutes IA (JSON libre)
        eventDate: dto.eventDate ?? null,
        extMatchId: dto.extMatchId ?? null,
        gradeType: dto.gradeType ?? null,
        tier,
        isValidated: dto.isValidated ?? tier !== 'free', // la cote gratuite attend l'admin
      },
    });
    if (p.isValidated) {
      this.realtime.emit({ type: 'prediction.new', data: { tier: p.tier, market: p.market } });
    }
    return p;
  }
}
