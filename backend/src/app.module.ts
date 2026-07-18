import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FlashModule } from './flash/flash.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CmsModule } from './cms/cms.module';
import { PredictionsModule } from './predictions/predictions.module';
import { InvestmentsModule } from './investments/investments.module';
import { PaymentsModule } from './payments/payments.module';
import { MediaModule } from './media/media.module';
import { StatsModule } from './stats/stats.module';
import { RealtimeModule } from './realtime/realtime.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CheckoutModule } from './checkout/checkout.module';
import { HealthController } from './health/health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Rate-limiting global par défaut (anti brute-force / spam). Les routes sensibles
    // (login, signup, leads Flash) surchargent ce plafond avec des limites plus strictes
    // via @Throttle(...) directement sur leurs handlers.
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
    ]),
    PrismaModule,
    RealtimeModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    FlashModule,
    ReviewsModule,
    CmsModule,
    PredictionsModule,
    InvestmentsModule,
    PaymentsModule,
    CheckoutModule,
    MediaModule,
    StatsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
