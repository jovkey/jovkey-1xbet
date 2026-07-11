import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { PaymentsService } from '../payments/payments.service';
import { EmailService } from '../email/email.service';
import { LoginDto, SignupGoldDto, SignupInvestorDto } from './dto';

/** Abonnement Gold : 5600 FCFA / mois (≈ 10 $). Montant par défaut. */
export const GOLD_PRICE_XOF = 5600;
const RESET_CODE_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private realtime: RealtimeService,
    private paymentsService: PaymentsService,
    private email: EmailService,
  ) {}

  /**
   * Connexion réservée aux comptes Gold / Investisseur / admin ACTIFS.
   * Un Gold dont le paiement n'est pas encore validé reste bloqué avec un
   * message explicite. Le public anonyme (gratuit / Flash) n'a aucun compte.
   */
  async login(dto: LoginDto) {
    // Connexion par email (insensible à la casse / espaces).
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    if (user.accountStatus === 'pending_payment') {
      throw new UnauthorizedException(
        'Votre paiement est en cours de validation par l’administration. ' +
          'Vous recevrez l’accès dès qu’il sera confirmé.',
      );
    }
    if (user.accountStatus === 'suspended') {
      throw new UnauthorizedException('Compte suspendu. Contactez le support.');
    }
    // Gold expiré : on N'EMPÊCHE PLUS la connexion (contrairement à avant) — le membre
    // se connecte normalement, mais son flux de pronostics reste verrouillé côté
    // predictions.service.ts avec un message de renouvellement (cf. §12 du cahier).
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Identifiants invalides');

    const token = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return {
      access_token: token,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  private async ensureFreeEmail(email: string) {
    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email.');
    }
  }

  /**
   * Inscription Gold : crée le compte en `pending_payment` + un paiement
   * d'abonnement en attente. L'admin valide le paiement pour activer l'accès.
   */
  /** Prix Gold courant : réglage CMS `gold_price` modifiable, sinon valeur par défaut. */
  private async goldPrice(): Promise<number> {
    const setting = await this.prisma.cmsSetting.findUnique({ where: { key: 'gold_price' } });
    const amount = Number((setting?.value as { amount?: number } | null)?.amount);
    return amount > 0 ? amount : GOLD_PRICE_XOF;
  }

  async signupGold(dto: SignupGoldDto) {
    const email = dto.email.trim().toLowerCase();
    await this.ensureFreeEmail(email);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const price = await this.goldPrice();

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'gold',
        accountStatus: 'pending_payment',
        statusFlash: 'approved',
        country: dto.country?.trim() || null,
      },
    });

    // Paiement FedaPay : le compte s'active AUTOMATIQUEMENT dès paiement confirmé (webhook).
    const { paymentId, paymentUrl, mode } = await this.paymentsService.initFedapay(
      user.id,
      'gold_subscription',
      undefined,
      { email },
    );

    this.realtime.emit({ type: 'payment.new', data: { userId: user.id, purpose: 'gold_subscription' } });
    return {
      ok: true,
      accountStatus: 'pending_payment',
      paymentId,
      paymentUrl,
      mode,
      message:
        `Compte créé. Vous allez être redirigé vers le paiement de ${price.toLocaleString('fr-FR')} FCFA. ` +
        'Votre accès s’ouvrira automatiquement dès le paiement confirmé.',
    };
  }

  /**
   * Inscription Investisseur : compte actif immédiatement, sans paiement.
   * L'investisseur rechargera son capital depuis son espace.
   */
  async signupInvestor(dto: SignupInvestorDto) {
    const email = dto.email.trim().toLowerCase();
    await this.ensureFreeEmail(email);
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'investor',
        accountStatus: 'active',
        statusFlash: 'approved',
        country: dto.country?.trim() || null,
      },
    });

    const token = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return {
      ok: true,
      access_token: token,
      user: { id: user.id, email: user.email, role: user.role },
      message: 'Compte investisseur créé. Vous pouvez recharger votre capital.',
    };
  }

  /** Changement de mot de passe par un membre déjà connecté (exige l'ancien). */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) throw new NotFoundException('Compte introuvable');
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Mot de passe actuel incorrect.');
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { ok: true, message: 'Mot de passe mis à jour.' };
  }

  /**
   * Demande de réinitialisation : génère un code à 6 chiffres (15 min), l'envoie par email.
   * Réponse générique dans tous les cas (compte existant ou non) pour ne pas révéler
   * quels emails ont un compte.
   */
  async forgotPassword(email: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalized, mode: 'insensitive' } },
    });
    if (user) {
      const code = String(randomInt(100000, 1000000)); // 6 chiffres
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordResetCode: code, passwordResetExpiresAt: new Date(Date.now() + RESET_CODE_TTL_MS) },
      });
      await this.email.sendPasswordResetCode(normalized, code);
    }
    return {
      ok: true,
      message: 'Si un compte existe avec cet email, un code de réinitialisation vient d’être envoyé.',
    };
  }

  /** Vérifie le code reçu par email puis change le mot de passe. */
  async resetPassword(email: string, code: string, newPassword: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: normalized, mode: 'insensitive' } },
    });
    if (
      !user ||
      !user.passwordResetCode ||
      user.passwordResetCode !== code ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt < new Date()
    ) {
      throw new BadRequestException('Code invalide ou expiré.');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordResetCode: null, passwordResetExpiresAt: null },
    });
    return { ok: true, message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' };
  }
}
