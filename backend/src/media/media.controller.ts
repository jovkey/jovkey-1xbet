import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { openSync, readSync, closeSync, unlinkSync } from 'fs';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { MediaService, UPLOAD_DIR } from './media.service';
import { CloudinaryService } from './cloudinary.service';
import { detectRealKind } from './file-signature';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

@ApiTags('media')
@Controller('media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class MediaController {
  constructor(
    private media: MediaService,
    private cloudinary: CloudinaryService,
  ) {}

  /** Liste de la bibliothèque média (images + vidéos). */
  @Get()
  list() {
    return this.media.list();
  }

  /**
   * Signature d'upload direct Cloudinary (SDK côté backend). Le front envoie ensuite le
   * fichier DIRECTEMENT à Cloudinary avec ces paramètres — le secret d'API ne quitte
   * jamais le serveur.
   */
  @Get('cloudinary/signature')
  cloudinarySignature() {
    return this.cloudinary.createUploadSignature();
  }

  /** Upload d'une image ou vidéo depuis le PC / téléphone (max 200 Mo). */
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 200 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');
        cb(ok ? null : new BadRequestException('Seules les images et vidéos sont acceptées.'), ok);
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');

    // Vérification MAGIC BYTES : le mimetype/l'extension déclarés par le client ne prouvent
    // rien (falsifiables). On lit les premiers octets du fichier réellement écrit sur disque
    // et on les compare aux signatures binaires connues des formats image/vidéo acceptés.
    const declaredKind = file.mimetype.startsWith('image/') ? 'image' : 'video';
    const path = join(UPLOAD_DIR, file.filename);
    const fd = openSync(path, 'r');
    const header = Buffer.alloc(16);
    readSync(fd, header, 0, 16, 0);
    closeSync(fd);
    const realKind = detectRealKind(header);

    if (!realKind || realKind !== declaredKind) {
      unlinkSync(path); // on ne garde jamais un fichier dont le contenu ne correspond pas
      throw new BadRequestException(
        'Le contenu réel du fichier ne correspond pas à une image/vidéo valide (signature binaire invalide).',
      );
    }

    return this.media.register(file);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.media.remove(id);
  }
}
