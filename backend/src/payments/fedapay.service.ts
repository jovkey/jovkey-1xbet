import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Intégration FedaPay (agrégateur de paiements Afrique de l'Ouest :
 * Mobile Money, carte bancaire…).
 *
 * Flux : on crée une transaction → on génère un token de paiement (URL de checkout)
 * → le client paie → FedaPay appelle notre webhook → on vérifie puis on active.
 *
 * ENVIRONNEMENT : FEDAPAY_ENVIRONMENT="sandbox" (test) ou "live" (réel). Pour passer
 * en production, il suffit de changer FEDAPAY_ENVIRONMENT + les clés (pk_live_/sk_live_)
 * dans le .env — aucune modification de code n'est nécessaire.
 *
 * Sans FEDAPAY_SECRET_KEY configurée, le service tombe en mode simulation locale
 * (comme l'ancienne intégration CinetPay) pour permettre de tester sans clés.
 */
@Injectable()
export class FedapayService {
  private readonly logger = new Logger(FedapayService.name);

  private get secretKey() { return process.env.FEDAPAY_SECRET_KEY || ''; }
  private get webhookSecret() { return process.env.FEDAPAY_WEBHOOK_SECRET || ''; }
  private get environment(): 'sandbox' | 'live' {
    return process.env.FEDAPAY_ENVIRONMENT === 'live' ? 'live' : 'sandbox';
  }
  private get baseUrl() {
    return this.environment === 'live'
      ? 'https://api.fedapay.com/v1'
      : 'https://sandbox-api.fedapay.com/v1';
  }
  // .trim() + retrait du slash final : une variable collée dans le dashboard Render
  // embarque parfois un espace/saut de ligne invisible en fin de valeur, ce qui casse
  // silencieusement l'URL construite (callback_url, notifyUrl…).
  private get apiPublicUrl() { return (process.env.API_PUBLIC_URL || 'http://localhost:4000').trim().replace(/\/+$/, ''); }
  private get frontendUrl() { return (process.env.FRONTEND_URL || 'http://localhost:3000').trim().replace(/\/+$/, ''); }

  /** 'production' = appels réels à l'API FedaPay (sandbox ou live selon FEDAPAY_ENVIRONMENT). */
  get mode(): 'production' | 'simulation' {
    return this.secretKey ? 'production' : 'simulation';
  }

  returnUrl(paymentId: string) {
    return `${this.frontendUrl}/paiement/retour?tx=${encodeURIComponent(paymentId)}`;
  }

  /**
   * Crée une transaction FedaPay puis génère son token de paiement.
   * Renvoie l'URL de checkout à laquelle rediriger le client + l'id de transaction FedaPay
   * (à stocker comme `providerTxId`, il sert ensuite à retrouver le paiement depuis le webhook).
   */
  async initPayment(params: {
    paymentId: string;
    amount: number;
    description: string;
    customer?: { name?: string; email?: string; phone?: string };
  }): Promise<{ paymentUrl: string; providerTxId: string }> {
    if (this.mode === 'simulation') {
      // Page locale de simulation (aucune clé requise) — même principe que l'ex-CinetPay.
      return {
        paymentUrl: `${this.apiPublicUrl}/api/payments/fedapay/simulate/${params.paymentId}`,
        providerTxId: `SIM-${params.paymentId}`,
      };
    }

    const [firstname, ...rest] = (params.customer?.name || 'Client Jovkey').trim().split(/\s+/);
    const customer: Record<string, unknown> = {
      firstname: firstname || 'Client',
      lastname: rest.join(' ') || 'Jovkey',
    };
    if (params.customer?.email) customer.email = params.customer.email;
    if (params.customer?.phone) customer.phone_number = { number: params.customer.phone, country: 'bj' };
    // FedaPay exige au moins un email ou un numéro sur le client.
    if (!customer.email && !customer.phone_number) customer.email = `client-${params.paymentId}@jovkey.local`;

    const createRes = await fetch(`${this.baseUrl}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.secretKey}` },
      body: JSON.stringify({
        description: params.description,
        amount: Math.round(params.amount),
        currency: { iso: 'XOF' },
        callback_url: this.returnUrl(params.paymentId),
        customer,
      }),
    });
    const createJson: any = await createRes.json().catch(() => ({}));
    const transaction = createJson?.['v1/transaction'] ?? createJson?.transaction;
    if (!createRes.ok || !transaction?.id) {
      this.logger.error(`Création transaction FedaPay échouée: ${JSON.stringify(createJson)}`);
      throw new Error('Initialisation du paiement FedaPay impossible.');
    }

    const tokenRes = await fetch(`${this.baseUrl}/transactions/${transaction.id}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.secretKey}` },
    });
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    const paymentUrl = tokenJson?.token?.url ?? tokenJson?.url;
    if (!tokenRes.ok || !paymentUrl) {
      this.logger.error(`Génération du lien de paiement FedaPay échouée: ${JSON.stringify(tokenJson)}`);
      throw new Error('Lien de paiement FedaPay indisponible.');
    }

    return { paymentUrl, providerTxId: String(transaction.id) };
  }

  /** Vérifie le statut réel d'une transaction via l'API (appelé par le webhook, jamais fait confiance au seul body reçu). */
  async verify(providerTxId: string): Promise<'approved' | 'declined' | 'canceled' | 'pending'> {
    if (this.mode === 'simulation') return 'pending'; // la confirmation passe par la page de simulation
    const res = await fetch(`${this.baseUrl}/transactions/${providerTxId}`, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    });
    const json: any = await res.json().catch(() => ({}));
    const status = (json?.['v1/transaction'] ?? json?.transaction)?.status;
    if (status === 'approved') return 'approved';
    if (status === 'declined' || status === 'canceled') return status;
    return 'pending';
  }

  /**
   * Vérifie la signature du webhook FedaPay (header `X-FEDAPAY-SIGNATURE`,
   * format `t=<timestamp>,s=<signature hmac-sha256(secret, "<timestamp>.<rawBody>")>`).
   * Protège contre les fausses validations de paiement envoyées par un tiers.
   */
  verifySignature(rawBody: string, signatureHeader?: string | string[]): boolean {
    if (!this.webhookSecret) {
      // Pas encore configuré (ex. sandbox locale sans webhook créé côté FedaPay) :
      // on laisse passer mais on log fort — à corriger avant toute mise en production.
      this.logger.warn(
        'FEDAPAY_WEBHOOK_SECRET non configuré : signature du webhook NON vérifiée. ' +
          'Crée le webhook dans le dashboard FedaPay puis renseigne le secret avant la prod.',
      );
      return true;
    }
    const header = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!header) return false;

    const parts = Object.fromEntries(
      header.split(',').map((p) => {
        const [k, v] = p.split('=');
        return [k?.trim(), v?.trim()];
      }),
    );
    const timestamp = parts['t'];
    const signature = parts['s'];
    if (!timestamp || !signature) return false;

    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== receivedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  }
}
