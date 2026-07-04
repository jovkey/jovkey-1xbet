import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { CloudinaryService } from './cloudinary.service';

@Module({
  controllers: [MediaController],
  providers: [MediaService, CloudinaryService],
})
export class MediaModule {}
