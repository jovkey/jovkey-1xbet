import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { DeviceTokenGuard } from './device-token.guard';
import { CheckoutService } from './checkout.service';
import { ChariowService } from './chariow.service';
import { CheckoutInitDto, SmsWebhookDto } from './dto';

@ApiTags('checkout')
@Controller('checkout')
export class CheckoutController {
  constructor(
    private checkout: CheckoutService,
    private chariow: ChariowService,
  ) {}

  /** Puces actives à afficher au client (par réseau). Public : aucune donnée sensible. */
  @Get('receivers')
  receivers() {
    return this.checkout.receivers();
  }

  /** Le client déclare son envoi (crée la transaction pending). */
  @Post('init')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  init(@CurrentUser() user: AuthUser, @Body() dto: CheckoutInitDto) {
    return this.checkout.init(user.id, dto);
  }

  /** Polling d'état (toutes les 2 s côté front). */
  @Get('status/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  status(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.checkout.status(user.id, id);
  }

  /** Webhook du téléphone Listener — protégé par le token appareil (Bearer). */
  @Post('webhook/sms')
  @UseGuards(DeviceTokenGuard)
  webhook(@Body() dto: SmsWebhookDto) {
    return this.checkout.reconcile(dto);
  }

  /**
   * SMS BRUT relayé par une app « SMS Forwarder » sur le téléphone Listener.
   * Corps attendu : { text: "<texte du SMS>", from: "<expéditeur, ex. MoovMoney>" }
   * et `?receiver=96530302` pour dire SUR QUELLE PUCE le SMS est arrivé (une règle de
   * transfert par SIM). Le décodage et les 5 barrières de sécurité sont côté serveur.
   */
  @Post('webhook/sms-raw')
  @UseGuards(DeviceTokenGuard)
  webhookRaw(
    @Body() body: { text?: string; message?: string; from?: string; sender?: string; receiver?: string },
    @Query('receiver') receiverQuery?: string,
  ) {
    return this.checkout.ingestRawSms({
      text: body?.text || body?.message || '',
      from: body?.from || body?.sender,
      receiverPhone: receiverQuery || body?.receiver || '',
    });
  }

  // ── Chariow (Pack Gold « Paiement rapide ») ──────────────────────────

  /**
   * Webhook Chariow « vente réussie ». Non gardé par JWT (appel serveur-à-serveur), mais
   * la sécurité vient de la REVÉRIFICATION via l'API Chariow dans le service : un faux
   * appel ne peut rien débloquer car on confirme la vente auprès de Chariow lui-même.
   */
  @Post('chariow/webhook')
  chariowWebhook(@Body() body: any) {
    return this.chariow.handleWebhook(body);
  }

  /**
   * Page de retour après paiement Chariow (lien « instructions après achat » avec
   * {{saleId}}). PUBLIC volontairement : l'activation se fait par l'email de l'acheteur
   * (revérifié auprès de Chariow), pas par la session — le client n'a donc pas besoin
   * d'être déjà connecté en revenant de la boutique. Sûr : seules de vraies ventes
   * payées activent quelque chose, et c'est idempotent.
   */
  @Get('chariow/status/:saleId')
  chariowStatus(@Param('saleId') saleId: string) {
    return this.chariow.activateFromSale(saleId);
  }
}
