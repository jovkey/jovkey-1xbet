import { Body, Controller, Get, Header, HttpCode, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { FedapayService } from './fedapay.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { RechargeDto } from '../auth/dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private payments: PaymentsService,
    private fedapay: FedapayService,
  ) {}

  // ── FedaPay (paiements automatiques) ─────────────────────────────

  /** Investisseur : démarre une recharge via FedaPay → renvoie l'URL de paiement. */
  @Post('fedapay/init')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('investor')
  initFedapay(@CurrentUser() user: AuthUser, @Body() body: { amount: number }) {
    return this.payments.initFedapay(user.id, 'investor_deposit', Number(body?.amount), {
      email: user.email ?? undefined,
    });
  }

  /**
   * Webhook FedaPay (serveur→serveur) : vérifie la signature puis confirme le paiement.
   * `main.ts` active `rawBody: true` afin que `req.rawBody` contienne le corps brut
   * nécessaire au calcul HMAC (le body JSON parsé ne suffit pas, la signature porte
   * sur les octets exacts envoyés par FedaPay).
   */
  @Post('fedapay/webhook')
  @HttpCode(200)
  webhook(@Req() req: Request, @Body() body: any) {
    const rawBody = (req as any).rawBody?.toString('utf8') ?? JSON.stringify(body);
    const signature = req.headers['x-fedapay-signature'] as string | undefined;
    if (!this.fedapay.verifySignature(rawBody, signature)) {
      throw new UnauthorizedException('Signature webhook FedaPay invalide.');
    }
    const txId = body?.entity?.id ?? body?.data?.id ?? body?.id;
    if (!txId) return { ok: false, reason: 'no transaction id' };
    return this.payments.fedapayNotify(String(txId));
  }

  /** Page de SIMULATION (mode local sans clés) : simule le checkout FedaPay. */
  @Get('fedapay/simulate/:txId')
  @Header('Content-Type', 'text/html; charset=utf-8')
  simulatePage(@Param('txId') txId: string) {
    const back = this.fedapay.returnUrl(txId);
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Paiement (simulation)</title>
<style>body{font-family:system-ui;background:#0f172a;color:#f8fafc;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{background:#1e293b;border:1px solid #f59e0b40;border-radius:20px;padding:28px;max-width:360px;text-align:center}
button{border:0;border-radius:12px;padding:14px;font-weight:800;width:100%;margin-top:10px;cursor:pointer}
.pay{background:linear-gradient(135deg,#f59e0b,#d97706);color:#000}.cancel{background:#334155;color:#fff}
small{color:#94a3b8}</style></head><body>
<div class="card">
<h2>💳 Paiement FedaPay <small>(simulation)</small></h2>
<p>Transaction <b>${txId}</b></p>
<button class="pay" onclick="go(true)">✅ J'ai payé</button>
<button class="cancel" onclick="go(false)">Annuler</button>
<p><small>Mode simulation — aucune vraie transaction. Branche tes clés FedaPay pour le paiement réel.</small></p>
</div>
<script>
async function go(ok){
  await fetch('/api/payments/fedapay/simulate/${txId}/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accepted:ok})});
  window.location.href='${back}';
}
</script></body></html>`;
  }

  /** Confirmation de la simulation (déclenche l'activation/crédit auto). */
  @Post('fedapay/simulate/:txId/confirm')
  simulateConfirm(@Param('txId') txId: string, @Body() body: { accepted?: boolean }) {
    return this.payments.confirmFedapay(`SIM-${txId}`, body?.accepted !== false);
  }

  /**
   * Filet de sécurité : la page de retour du client interroge cet endpoint pour
   * savoir si le paiement est confirmé, même si le webhook n'a pas encore été
   * délivré (tunnel local coupé, retard réseau…). Rien de sensible n'est exposé
   * (juste statut + type), l'id de paiement (cuid) n'est pas devinable.
   */
  @Get('fedapay/status/:paymentId')
  checkStatus(@Param('paymentId') paymentId: string) {
    return this.payments.checkStatus(paymentId);
  }

  // ── Existant ──────────────────────────────────────────────────────

  /** Investisseur : recharge « déclarée » (validation manuelle admin) — conservé en secours. */
  @Post('recharge')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('investor')
  recharge(@CurrentUser() user: AuthUser, @Body() dto: RechargeDto) {
    return this.payments.recharge(user.id, dto);
  }

  @Get('mine')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: AuthUser) {
    return this.payments.mine(user.id);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  listPending() {
    return this.payments.listPending();
  }

  @Post(':id/validate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  validate(@Param('id') id: string) {
    return this.payments.validate(id);
  }

  @Post(':id/reject')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  reject(@Param('id') id: string) {
    return this.payments.reject(id);
  }
}
