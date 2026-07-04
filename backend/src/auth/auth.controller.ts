import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, SignupGoldDto, SignupInvestorDto } from './dto';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

export const AUTH_COOKIE = 'jovkey_token';

/** Convertit un format court NestJS/JWT ("7d", "12h", "30m") en millisecondes. */
function parseExpiryMs(expiresIn: string): number {
  const match = /^(\d+)([smhd])$/.exec(expiresIn.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000; // repli : 7 jours
  const value = Number(match[1]);
  const unit = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]]!;
  return value * unit;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  /**
   * Pose le JWT dans un cookie httpOnly (inaccessible à un script XSS côté navigateur) —
   * il ne transite plus jamais par le localStorage ni le corps de réponse JSON.
   */
  private setAuthCookie(res: Response, token: string) {
    res.cookie(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: parseExpiryMs(process.env.JWT_EXPIRES_IN || '7d'),
      path: '/',
    });
  }

  /** Anti brute-force : 5 tentatives / minute par IP. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { access_token, user } = await this.auth.login(dto);
    this.setAuthCookie(res, access_token);
    return { ok: true, user };
  }

  /** Inscription Gold : paiement 5600 FCFA obligatoire (validé ensuite par l'admin). Pas de session ouverte tant que non payé. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('signup/gold')
  signupGold(@Body() dto: SignupGoldDto) {
    return this.auth.signupGold(dto);
  }

  /** Inscription Investisseur : sans paiement immédiat, compte actif → session ouverte directement. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('signup/investor')
  async signupInvestor(@Body() dto: SignupInvestorDto, @Res({ passthrough: true }) res: Response) {
    const { access_token, user, message } = await this.auth.signupInvestor(dto);
    this.setAuthCookie(res, access_token);
    return { ok: true, user, message };
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  /** Déconnexion : efface le cookie de session côté navigateur. */
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE, { path: '/' });
    return { ok: true };
  }
}
