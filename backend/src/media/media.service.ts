import { Injectable, NotFoundException } from '@nestjs/common';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Dossier de stockage des fichiers uploadés.
 * En prod, pointer UPLOAD_DIR vers un volume PERSISTANT (sinon, sur un hébergeur
 * éphémère type serverless, les fichiers seraient perdus au redéploiement).
 */
export const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'uploads');

// Crée le dossier au démarrage du module si absent.
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

@Injectable()
export class MediaService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.mediaAsset.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /** Enregistre en base le fichier déjà écrit sur disque par multer. */
  async register(file: Express.Multer.File) {
    const kind = file.mimetype.startsWith('image/') ? 'image' : 'video';
    return this.prisma.mediaAsset.create({
      data: {
        filename: file.filename,
        originalName: file.originalname,
        url: `/uploads/${file.filename}`,
        mimeType: file.mimetype,
        kind,
        size: file.size,
      },
    });
  }

  async remove(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Média introuvable');
    try {
      const path = join(UPLOAD_DIR, asset.filename);
      if (existsSync(path)) unlinkSync(path);
    } catch {
      /* le fichier a pu être supprimé manuellement : on continue */
    }
    await this.prisma.mediaAsset.delete({ where: { id } });
    return { ok: true };
  }
}
