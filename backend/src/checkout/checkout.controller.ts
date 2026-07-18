import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { DeviceTokenGuard } from './device-token.guard';
import { CheckoutService } from './checkout.service';
import { CheckoutInitDto, SmsWebhookDto } from './dto';

@ApiTags('checkout')
@Controller('checkout')
export class CheckoutController {
  constructor(private checkout: CheckoutService) {}

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
}
