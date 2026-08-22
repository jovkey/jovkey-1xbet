import { Module } from '@nestjs/common';
import { PushService } from './push.service';
import { PushController } from './push.controller';

/**
 * Notifications push Web (VAPID). Exporte PushService pour que d'autres modules
 * (ex. Predictions) puissent notifier automatiquement lors de la publication d'un coupon.
 */
@Module({
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
