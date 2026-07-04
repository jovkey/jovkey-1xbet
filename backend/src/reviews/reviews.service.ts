import { Injectable } from '@nestjs/common';
import { ReviewStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CreateReviewDto } from './reviews.controller';

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
  ) {}

  listPublished() {
    return this.prisma.review.findMany({
      where: { status: 'published' },
      orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
    });
  }

  listPending() {
    return this.prisma.review.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateReviewDto) {
    // ≥4★ publié d'emblée ; <4★ part en modération (conservé, pas supprimé).
    const status: ReviewStatus = dto.rating >= 4 ? 'published' : 'pending';
    const review = await this.prisma.review.create({
      data: {
        authorName: dto.authorName,
        rating: dto.rating,
        body: dto.body,
        status,
        userId: dto.userId ?? null,
        isSeed: false,
      },
    });

    if (dto.userId) {
      await this.prisma.user.update({
        where: { id: dto.userId },
        data: { reviewsWritten: { increment: 1 } },
      });
    }
    if (status === 'published') {
      this.realtime.emit({ type: 'review.published', data: { id: review.id } });
    }
    return review;
  }

  async setStatus(id: string, status: ReviewStatus) {
    const review = await this.prisma.review.update({ where: { id }, data: { status } });
    this.realtime.emit({ type: 'review.moderated', data: { id, status } });
    return review;
  }

  async countForUser(userId: string) {
    const count = await this.prisma.review.count({ where: { userId } });
    return { reviewsWritten: count, requiredForCritical: 5, unlocked: count >= 5 };
  }

  /** Outil de seeding : injecte des avis de démonstration (marqués is_seed). */
  async seedDemo() {
    const pool = [
      { authorName: 'Awa K.', rating: 5, body: 'Coupon validé du premier coup, interface ultra claire. Je recommande !' },
      { authorName: 'Yann T.', rating: 5, body: 'Le code JOVKEY m’a doublé mon premier dépôt. Service au top.' },
      { authorName: 'Fatou D.', rating: 4, body: 'Bon suivi des pronostics, j’attends les grosses cotes de la semaine.' },
      { authorName: 'Kossi A.', rating: 5, body: 'Pack Gold rentabilisé en 3 jours. Les analyses IA sont sérieuses.' },
      { authorName: 'Marie L.', rating: 4, body: 'Communauté réactive, retraits sans souci. Continuez comme ça.' },
    ];
    const created = await this.prisma.review.createMany({
      data: pool.map((r) => ({ ...r, status: 'published' as ReviewStatus, isSeed: true })),
    });
    this.realtime.emit({ type: 'review.published', data: { seeded: created.count } });
    return { ok: true, seeded: created.count };
  }
}
