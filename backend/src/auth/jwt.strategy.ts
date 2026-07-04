import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/current-user.decorator';

/** Lit le JWT depuis le cookie httpOnly `jovkey_token` (posé au login/signup). */
function fromCookie(req: Request): string | null {
  return req?.cookies?.jovkey_token || null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    if (!process.env.JWT_SECRET) {
      // Aucun secret faible par défaut : on refuse de démarrer plutôt que de signer
      // silencieusement avec une valeur devinable (dev y compris — .env.example en fournit une).
      throw new Error('JWT_SECRET manquant : définis-le dans .env (chaîne aléatoire longue).');
    }
    super({
      // Cookie httpOnly en priorité (protège le token d'un vol par XSS côté navigateur) ;
      // fallback Bearer conservé pour les clients API non-navigateur (Swagger, scripts).
      jwtFromRequest: ExtractJwt.fromExtractors([fromCookie, ExtractJwt.fromAuthHeaderAsBearerToken()]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: { sub: string }): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.statusFlash === 'rejected') {
      throw new UnauthorizedException('Compte introuvable ou révoqué');
    }
    return { id: user.id, email: user.email, id1xbet: user.id1xbet, role: user.role };
  }
}
