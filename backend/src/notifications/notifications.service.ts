import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
  ) {}

  /** Crée une notification pour un membre et la pousse en direct (SSE) à qui écoute. */
  async notify(userId: string, message: string, type: 'info' | 'success' | 'warning' = 'info') {
    const n = await this.prisma.notification.create({ data: { userId, message, type } });
    this.realtime.emit({ type: 'notification.new', data: { userId } });
    return n;
  }

  /** Notifications d'un membre (les plus récentes d'abord). */
  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }

  async markRead(userId: string, id: string) {
    // Le userId dans le where empêche un membre de marquer lues les notifs d'un autre.
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
    return { ok: true };
  }
}
