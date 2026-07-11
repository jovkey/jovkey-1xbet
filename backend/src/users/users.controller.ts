import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

@ApiTags('users')
@Controller('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Roles('admin')
  list() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        id1xbet: true,
        whatsappNum: true,
        role: true,
        accountStatus: true,
        country: true,
        statusFlash: true,
        reviewsWritten: true,
        lastInvestmentDate: true,
        eligibleForReinvest: true,
        balanceWithdrawable: true,
        balanceUnderAnalysis: true,
        balanceFrozen: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Élévation de rôle réservée au superadmin (§5).
   * Garde-fou : on ne peut PAS modifier son propre rôle (anti auto-rétrogradation).
   */
  @Patch(':id/role')
  @Roles('superadmin')
  setRole(
    @Param('id') id: string,
    @Body() body: { role: Role },
    @CurrentUser() me: AuthUser,
  ) {
    if (id === me.id) {
      throw new BadRequestException('Vous ne pouvez pas modifier votre propre rôle.');
    }
    return this.prisma.user.update({ where: { id }, data: { role: body.role } });
  }

  /**
   * Suppression définitive d'un membre, réservée au superadmin. Le schéma cascade
   * (investissements, avis, paiements, retraits, notifications) est nettoyé
   * automatiquement par la base — action irréversible.
   */
  @Delete(':id')
  @Roles('superadmin')
  async remove(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    if (id === me.id) {
      throw new BadRequestException('Vous ne pouvez pas supprimer votre propre compte.');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Membre introuvable');
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }
}
