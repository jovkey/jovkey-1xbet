import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';

/** Statuts Chariow considérés comme « payé ». */
const PAID_STATUSES = ['completed', 'settled'];

interface VerifiedSale {
  id: string;
  status: string;
  amount: number;
  email: string | null;
  productId: string | null;
}

/**
 * Intégration Chariow pour le Pack Gold (« Paiement rapide »). Le client paie sur le lien
 * statique Chariow (carte + local) ; Chariow nous prévient par webhook (« vente réussie »).
 * SÉCURITÉ : on ne fait jamais confiance au corps du webhook — on REVÉRIFIE chaque vente
 * via l'API Chariow (GET /v1/sales/{id}) avec la clé secrète. L'accès Gold est donc
 * débloqué uniquement si Chariow confirme lui-même que la vente est payée.
 */
@Injectable()
export class ChariowService {
  private readonly logger = new Logger(ChariowService.name);

  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
    private notifications: NotificationsService,
    private payments: PaymentsService,
  ) {}

  private get apiKey() { return (process.env.CHARIOW_API_KEY || '').trim(); }
  private get apiUrl() { return (process.env.CHARIOW_API_URL || 'https://api.chariow.com/v1').trim().replace(/\/+$/, ''); }
  // Produit Gold : seules les ventes de CE produit débloquent le Gold (sinon acheter
  // n'importe quel autre livre de la boutique activerait l'abonnement). Vide = pas de filtre.
  // Tolérant : accepte aussi bien "prd_xxx" que le lien complet "https://.../prd_xxx"
  // (erreur de copier-coller fréquente) — on en extrait l'identifiant produit.
  private get goldProductId() {
    const raw = (process.env.CHARIOW_GOLD_PRODUCT_ID || '').trim();
    return raw.match(/prd_[A-Za-z0-9]+/)?.[0] ?? raw;
  }

  /** Revérifie une vente auprès de Chariow. Renvoie null si introuvable / clé absente. */
  async verifySale(saleId: string): Promise<VerifiedSale | null> {
    if (!this.apiKey) { this.logger.warn('CHARIOW_API_KEY absente : vérification impossible.'); return null; }
    const res = await fetch(`${this.apiUrl}/sales/${encodeURIComponent(saleId)}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok) {
      this.logger.warn(`Vérification vente ${saleId} échouée (HTTP ${res.status}).`);
      return null;
    }
    const json: any = await res.json().catch(() => ({}));
    const s = json?.data ?? json;
    if (!s?.id) return null;
    return {
      id: String(s.id),
      status: String(s.status || ''),
      amount: Number(s.amount?.value ?? s.amount ?? 0),
      email: s.customer?.email ? String(s.customer.email).trim().toLowerCase() : null,
      productId: s.product?.id ? String(s.product.id) : null,
    };
  }

  /**
   * Débloque le Gold à partir d'une vente Chariow. Utilisé par le webhook ET par la page
   * de retour. Idempotent (providerTxId = saleId unique). L'ancre = l'email : le compte
   * activé est celui dont l'email correspond à l'acheteur.
   */
  async activateFromSale(saleId: string): Promise<{ activated: boolean; reason?: string }> {
    const sale = await this.verifySale(saleId);
    if (!sale) return { activated: false, reason: 'sale_not_found' };
    if (!PAID_STATUSES.includes(sale.status)) return { activated: false, reason: `status_${sale.status}` };
    if (this.goldProductId && sale.productId && sale.productId !== this.goldProductId) {
      return { activated: false, reason: 'other_product' };
    }
    if (!sale.email) return { activated: false, reason: 'no_email' };

    // Anti-rejeu : cette vente a-t-elle déjà activé un compte ?
    const already = await this.prisma.payment.findUnique({ where: { providerTxId: sale.id } });
    if (already) return { activated: true, reason: 'already_processed' };

    // Ancre : le compte JOVKEY dont l'email = l'email de l'acheteur Chariow.
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: sale.email, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) {
      this.logger.warn(`Vente Chariow ${sale.id} payée par ${sale.email} : aucun compte JOVKEY avec cet email.`);
      return { activated: false, reason: 'user_not_found' };
    }

    // Trace du paiement (providerTxId = saleId → idempotence) + activation mutualisée.
    await this.prisma.payment.create({
      data: {
        userId: user.id,
        amount: sale.amount,
        currency: 'XOF',
        method: 'card',
        purpose: 'gold_subscription',
        status: 'validated',
        providerTxId: sale.id,
        reference: `Chariow ${sale.email}`,
        reviewedAt: new Date(),
      },
    });
    await this.payments.applyGoldActivation(user.id, sale.amount);
    await this.notifications.notify(user.id, '✅ Ton Pack Gold est activé. Bienvenue !', 'success');
    this.realtime.emit({ type: 'transaction.completed', data: { userId: user.id, source: 'chariow' } });
    this.logger.log(`Gold activé via Chariow pour ${sale.email} (vente ${sale.id}).`);
    return { activated: true };
  }

  /** Webhook Chariow : on extrait l'id de vente (quel que soit l'emballage) puis on revérifie. */
  async handleWebhook(body: any): Promise<{ ok: true; activated: boolean; reason?: string }> {
    const saleId =
      body?.data?.id ?? body?.data?.sale?.id ?? body?.sale?.id ?? body?.id ?? body?.data?.sale_id ?? null;
    if (!saleId) {
      this.logger.warn('Webhook Chariow sans id de vente exploitable.');
      return { ok: true, activated: false, reason: 'no_sale_id' };
    }
    const r = await this.activateFromSale(String(saleId));
    return { ok: true, ...r };
  }
}
