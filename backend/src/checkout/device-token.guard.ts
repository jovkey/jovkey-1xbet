import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Protège POST /api/checkout/webhook/sms : seul le téléphone Listener, porteur du header
 * `Authorization: Bearer <SMS_DEVICE_TOKEN>`, est accepté. Comparaison à temps constant
 * (timingSafeEqual) pour ne pas fuiter le token via une attaque temporelle.
 */
@Injectable()
export class DeviceTokenGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const expected = (process.env.SMS_DEVICE_TOKEN || '').trim();

    if (!expected) {
      throw new UnauthorizedException('SMS_DEVICE_TOKEN non configuré côté serveur.');
    }
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Token appareil invalide.');
    }
    return true;
  }
}
