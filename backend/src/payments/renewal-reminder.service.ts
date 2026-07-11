import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';
import { EmailService } from '../email/email.service';

const REMINDER_WINDOW_DAYS = 3;

/**
 * Rappel automatique avant échéance Gold. FedaPay n'a pas de prélèvement récurrent
 * (vérifié dans leur doc API — aucune tokenisation carte pour charges futures), donc
 * le meilleur substitut honnête est ce rappel proactif + lien de renouvellement 1 clic,
 * plutôt que de laisser le membre découvrir l'expiration en se connectant.
 */
@Injectable()
export class RenewalReminderService {
  private readonly logger = new Logger(RenewalReminderService.name);

  constructor(
    private prisma: PrismaService,
    private payments: PaymentsService,
    private email: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendDueReminders() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const candidates = await this.prisma.user.findMany({
      where: {
        role: 'gold',
        accountStatus: 'active',
        email: { not: null },
        subscriptionEndsAt: { gte: now, lte: windowEnd },
      },
      select: { id: true, email: true, subscriptionEndsAt: true, renewalReminderSentFor: true },
    });

    for (const user of candidates) {
      // Déjà rappelé pour CE cycle (subscriptionEndsAt inchangé depuis le dernier rappel) → on saute.
      if (
        user.renewalReminderSentFor &&
        user.subscriptionEndsAt &&
        user.renewalReminderSentFor.getTime() === user.subscriptionEndsAt.getTime()
      ) {
        continue;
      }
      if (!user.email || !user.subscriptionEndsAt) continue;

      try {
        const token = await this.payments.generateRenewalToken(user.id);
        const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim().replace(/\/+$/, '');
        const link = `${frontendUrl}/renouveler?token=${token}`;
        const daysLeft = Math.max(0, Math.ceil((user.subscriptionEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
        await this.email.sendRenewalReminder(user.email, link, daysLeft);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { renewalReminderSentFor: user.subscriptionEndsAt },
        });
      } catch (err) {
        this.logger.error(`Rappel de renouvellement échoué pour ${user.id}: ${(err as Error).message}`);
      }
    }
  }
}
