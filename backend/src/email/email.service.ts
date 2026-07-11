import { Injectable, Logger } from '@nestjs/common';

/**
 * Envoi d'emails transactionnels via l'API REST Resend (pas de SDK, un simple fetch —
 * cohérent avec le reste du projet). Sans RESEND_API_KEY configurée, on loggue le
 * contenu au lieu d'échouer (utile en dev local sans compte Resend).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private get apiKey() { return (process.env.RESEND_API_KEY || '').trim(); }
  private get from() { return (process.env.RESEND_FROM || 'JOVKEY-1XBET <onboarding@resend.dev>').trim(); }

  get isConfigured(): boolean {
    return !!this.apiKey;
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.isConfigured) {
      this.logger.warn(
        `RESEND_API_KEY non configurée — email NON envoyé (affiché ici pour le dev) → à: ${to} | sujet: ${subject}\n${html}`,
      );
      return;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ from: this.from, to: [to], subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`Envoi email Resend échoué (${res.status}): ${body}`);
      throw new Error("Impossible d'envoyer l'email pour le moment.");
    }
  }

  /** Email de code de récupération de mot de passe (6 chiffres, expire vite). */
  async sendPasswordResetCode(to: string, code: string): Promise<void> {
    const html = `
      <div style="font-family:sans-serif;background:#0f172a;color:#f8fafc;padding:32px;border-radius:16px;max-width:420px;margin:auto;">
        <h1 style="color:#f59e0b;font-size:20px;margin:0 0 16px;">JOVKEY-1XBET</h1>
        <p style="margin:0 0 8px;">Voici ton code pour réinitialiser ton mot de passe :</p>
        <div style="font-size:32px;font-weight:900;letter-spacing:6px;background:#1e293b;padding:16px;border-radius:12px;text-align:center;margin:16px 0;">${code}</div>
        <p style="color:#94a3b8;font-size:13px;margin:0;">Ce code expire dans 15 minutes. Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>
      </div>
    `;
    await this.send(to, 'Ton code de réinitialisation JOVKEY-1XBET', html);
  }
}
