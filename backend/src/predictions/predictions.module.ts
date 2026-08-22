import { Module } from '@nestjs/common';
import { PredictionsController } from './predictions.controller';
import { PredictionsService } from './predictions.service';
import { PushModule } from '../push/push.module';

@Module({
  imports: [PushModule], // pour notifier automatiquement à la publication d'un coupon gratuit
  controllers: [PredictionsController],
  providers: [PredictionsService],
})
export class PredictionsModule {}
