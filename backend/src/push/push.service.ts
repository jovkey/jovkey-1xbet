import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Abonnement tel qu'envoyé par le navigateur (PushSubscription.toJSON()). */
export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private ready = false;

  constructor(private prisma: PrismaService) {
    const publicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
    const privateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
    const subject = (process.env.VAPID_SUBJECT || 'mailto:admin@coupongratuit.app').trim();
    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.ready = true;
    } else {
      this.logger.warn('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY absents → notifications push désactivées.');
    }
  }

  /** Clé publique exposée au frontend (nécessaire à l'abonnement côté navigateur). */
  publicKey(): string {
    return (process.env.VAPID_PUBLIC_KEY || '').trim();
  }

  isReady(): boolean {
    return this.ready;
  }

  /** Enregistre (ou met à jour) l'abonnement d'un appareil. Idempotent via `endpoint` unique. */
  async saveSubscription(sub: BrowserSubscription, userId?: string) {
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false };
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth, userId: userId ?? undefined },
      create: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userId: userId ?? null },
    });
    return { ok: true };
  }

  async removeSubscription(endpoint: string) {
    if (!endpoint) return { ok: true };
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
    return { ok: true };
  }

  async count(): Promise<number> {
    return this.prisma.pushSubscription.count();
  }

  /**
   * Envoie une notification à TOUS les appareils abonnés. Les abonnements morts
   * (404/410 = désinstallé / expiré) sont automatiquement supprimés pour garder la base propre.
   * Ne jette jamais : renvoie le compte d'envois réussis (utilisable par l'admin ET l'auto-notif).
   */
  async sendToAll(payload: PushPayload): Promise<{ sent: number; failed: number; total: number }> {
    if (!this.ready) {
      this.logger.warn('sendToAll ignoré : VAPID non configuré.');
      return { sent: 0, failed: 0, total: 0 };
    }
    const subs = await this.prisma.pushSubscription.findMany();
    const data = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/',
    });

    let sent = 0;
    let failed = 0;
    const dead: string[] = [];
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            data,
          );
          sent += 1;
        } catch (err: unknown) {
          failed += 1;
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) dead.push(s.endpoint);
        }
      }),
    );
    if (dead.length) {
      await this.prisma.pushSubscription.deleteMany({ where: { endpoint: { in: dead } } });
      this.logger.log(`${dead.length} abonnement(s) push expiré(s) supprimé(s).`);
    }
    this.logger.log(`Push diffusé : ${sent} envoyé(s), ${failed} échec(s) sur ${subs.length}.`);
    return { sent, failed, total: subs.length };
  }
}
