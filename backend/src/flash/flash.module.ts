import { Module } from '@nestjs/common';
import { FlashController } from './flash.controller';
import { FlashService } from './flash.service';

@Module({
  controllers: [FlashController],
  providers: [FlashService],
})
export class FlashModule {}
