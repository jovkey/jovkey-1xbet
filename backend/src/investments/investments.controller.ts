import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InvestmentsService } from './investments.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';
import { WithdrawalDto } from '../auth/dto';

@ApiTags('investments')
@Controller('investments')
export class InvestmentsController {
  constructor(private investments: InvestmentsService) {}

  /** Tableau de bord investisseur : 3 soldes + courbe + gate 5 avis + historique. */
  @Get('dashboard')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('investor')
  dashboard(@CurrentUser() user: AuthUser) {
    return this.investments.dashboard(user.id);
  }

  /** Demande de retrait : 5 avis requis + solde retirable suffisant + validation admin. */
  @Post('request-withdrawal')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('investor')
  requestWithdrawal(@CurrentUser() user: AuthUser, @Body() dto: WithdrawalDto) {
    return this.investments.requestWithdrawal(user.id, dto);
  }

  /** Admin : investisseurs actifs (capital gelé) ce cycle — outil de versement de fin de mois. */
  @Get('active-cycle')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  activeThisCycle() {
    return this.investments.activeThisCycle();
  }

  /** Admin : retraits en attente de validation. */
  @Get('withdrawals')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  listWithdrawals() {
    return this.investments.listWithdrawals();
  }

  @Post('withdrawals/:id/validate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  validateWithdrawal(@Param('id') id: string) {
    return this.investments.validateWithdrawal(id);
  }

  @Post('withdrawals/:id/reject')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  rejectWithdrawal(@Param('id') id: string) {
    return this.investments.rejectWithdrawal(id);
  }

  /** Admin : libère un capital gelé (+ gain) vers le solde retirable. */
  @Post(':userId/release')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  release(
    @Param('userId') userId: string,
    @Body() body: { amount: number; gain?: number },
  ) {
    return this.investments.releaseFrozen(userId, Number(body.amount), Number(body.gain || 0));
  }

  /** §4A — Routine d'élasticité : repêche les investisseurs les plus anciens. */
  @Post('elasticity/run')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  runElasticity() {
    return this.investments.runElasticity();
  }

  // ── Prospects investisseurs (bouton « Contacter l'administration ») ──

  /** Investisseur : enregistre son intérêt puis on l'oriente vers WhatsApp. */
  @Post('contact')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('investor')
  contact(@CurrentUser() user: AuthUser, @Body() body: { contact?: string; note?: string }) {
    return this.investments.createContactLead(user.id, body?.contact, body?.note);
  }

  /** Admin : liste des prospects investisseurs (avec l'identité du membre). */
  @Get('leads')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  listLeads() {
    return this.investments.listLeads();
  }

  /** Admin : change le statut d'un prospect (new | contacted | done). */
  @Post('leads/:id/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  setLeadStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.investments.setLeadStatus(id, body.status);
  }
}
