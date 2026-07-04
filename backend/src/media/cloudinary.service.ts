import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Upload direct signé vers Cloudinary (SDK officiel) : le navigateur de l'admin envoie
 * le fichier DIRECTEMENT à Cloudinary (pas via notre backend, donc pas de double transit
 * réseau pour une vidéo potentiellement lourde). Notre backend ne fait que signer la
 * requête avec le secret d'API (jamais exposé au client) — pattern recommandé par
 * Cloudinary pour les uploads pilotés par l'utilisateur final.
 */
@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  get isConfigured(): boolean {
    return !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
  }

  /** Génère les paramètres signés nécessaires à un upload direct depuis le navigateur admin. */
  createUploadSignature(folder = 'jovkey/tutorial') {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'Cloudinary non configuré (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET manquants).',
      );
    }
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = { timestamp, folder };
    const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET!);

    return {
      timestamp,
      folder,
      signature,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    };
  }
}
