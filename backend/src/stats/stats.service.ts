import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async track(body: { type: string; path?: string; visitorId?: string; source?: string }) {
    await this.prisma.trafficEvent.create({
      data: {
        type: body.type,
        path: body.path,
        visitorId: body.visitorId,
        source: body.source || 'direct',
      },
    });
    return { ok: true };
  }

  async overview() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [pageViews, promoClicks, couponCopies, uniqueRows, sourceGroups] = await Promise.all([
      this.prisma.trafficEvent.count({ where: { type: 'page_view' } }),
      this.prisma.trafficEvent.count({ where: { type: 'promo_click' } }),
      this.prisma.trafficEvent.count({ where: { type: 'coupon_copy' } }),
      this.prisma.trafficEvent.findMany({
        where: { createdAt: { gte: since }, visitorId: { not: null } },
        distinct: ['visitorId'],
        select: { visitorId: true },
      }),
      this.prisma.trafficEvent.groupBy({
        by: ['source'],
        where: { type: 'page_view' },
        _count: { _all: true },
      }),
    ]);

    const promoCtr = pageViews > 0 ? Number(((promoClicks / pageViews) * 100).toFixed(2)) : 0;

    const sources = sourceGroups
      .map((g) => ({ source: g.source || 'direct', count: g._count._all }))
      .sort((a, b) => b.count - a.count);

    return {
      pageViews,
      promoClicks,
      couponCopies,
      uniqueVisitors24h: uniqueRows.length,
      promoClickThroughRatePct: promoCtr,
      sources,
    };
  }
}
