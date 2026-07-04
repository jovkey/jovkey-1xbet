import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { FlashService } from './flash.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

export class FlashLeadDto {
  @ApiProperty({ example: '+228 79 19 33 20' })
  @IsString()
  @Matches(/^[+0-9 ]{8,20}$/, { message: 'Numéro WhatsApp invalide' })
  whatsappNum!: string;

  @ApiProperty({ example: '1XB-557788', description: 'Nouvel ID de compte 1xBet' })
  @IsString()
  @MinLength(3)
  id1xbet!: string;

  @ApiProperty({ enum: ['flash', 'gold', 'investor'], required: false })
  @IsOptional()
  @IsIn(['flash', 'gold', 'investor'])
  sourceTunnel?: string;
}

@ApiTags('flash')
@Controller('flash')
export class FlashController {
  constructor(private flash: FlashService) {}

  /** Soumission publique du tunnel → déclenche l'écran de temporisation 24h. Anti-spam : 3/min. */
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('leads')
  submit(@Body() dto: FlashLeadDto) {
    return this.flash.submitLead(dto);
  }

  /** Le front interroge l'état pour afficher "Analyse en cours" ou "Lien envoyé". */
  @Get('leads/:id/status')
  status(@Param('id') id: string) {
    return this.flash.getStatus(id);
  }

  // ── Modération admin ──────────────────────────────────────────
  @Get('leads')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  listPending() {
    return this.flash.listPending();
  }

  /**
   * Validation Flash (sans compte) : marque la demande approuvée. L'admin a
   * envoyé le lien communautaire par WhatsApp ; le client voit « compte validé ».
   */
  @Post('leads/:id/validate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  validateLead(@Param('id') id: string) {
    return this.flash.validateLead(id);
  }

  @Post('leads/:id/reject')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  reject(@Param('id') id: string) {
    return this.flash.reject(id);
  }
}
