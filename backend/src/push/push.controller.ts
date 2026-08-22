import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { PushService, BrowserSubscription, PushPayload } from './push.service';

@ApiTags('push')
@Controller('push')
export class PushController {
  constructor(private push: PushService) {}

  /** Clé publique VAPID — le navigateur en a besoin pour s'abonner. Public. */
  @Get('public-key')
  publicKey() {
    return { publicKey: this.push.publicKey(), enabled: this.push.isReady() };
  }

  /** Un appareil s'abonne (après installation + autorisation des notifications). Public. */
  @Post('subscribe')
  subscribe(@Body() body: { subscription: BrowserSubscription }) {
    return this.push.saveSubscription(body?.subscription);
  }

  /** Un appareil se désabonne. Public. */
  @Post('unsubscribe')
  unsubscribe(@Body() body: { endpoint: string }) {
    return this.push.removeSubscription(body?.endpoint);
  }

  /** Nombre d'appareils abonnés (affiché dans le panel admin). */
  @Get('count')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async count() {
    return { count: await this.push.count(), enabled: this.push.isReady() };
  }

  /** Diffuse une notification à TOUS les appareils abonnés. Réservé admin/superadmin. */
  @Post('send')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  send(@Body() body: PushPayload) {
    return this.push.sendToAll({
      title: (body?.title || 'Coupon Gratuit').slice(0, 80),
      body: (body?.body || '').slice(0, 250),
      url: body?.url,
    });
  }
}
