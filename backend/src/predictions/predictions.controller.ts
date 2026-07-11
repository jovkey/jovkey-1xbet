import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { PredictionsService } from './predictions.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { InternalKeyGuard } from '../common/internal-key.guard';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

export class IngestPredictionDto {
  @ApiProperty() @IsString() sport!: string;
  @ApiProperty() @IsString() match!: string;
  @ApiProperty() @IsString() market!: string;
  @ApiProperty() @IsString() selection!: string;
  @ApiProperty() @IsNumber() odds!: number;
  @ApiProperty() @IsInt() reliability!: number;
  // L'IA ne fournit JAMAIS de code coupon : c'est l'admin qui l'ajoute au moment de pousser.
  @ApiProperty({ required: false }) @IsOptional() @IsString() couponCode?: string;
  @ApiProperty() @IsNumber() valueScore!: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() tier?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isValidated?: boolean;
  @ApiProperty({ required: false, description: 'Données brutes IA (cotes de niche, arbitre, forme…)' })
  @IsOptional() @IsObject() analysis?: Record<string, unknown>;
  @ApiProperty({ required: false, example: '2026-06-24' }) @IsOptional() @IsString() eventDate?: string;
  @ApiProperty({ required: false, description: 'ID du match côté Sofascore (pour notation)' })
  @IsOptional() @IsString() extMatchId?: string;
  @ApiProperty({ required: false, description: 'Type de pari à noter (1x2_home, over25…)' })
  @IsOptional() @IsString() gradeType?: string;
}

export class PublishPredictionDto {
  @ApiProperty({ enum: ['free', 'gold', 'investor'] }) @IsString() tier!: 'free' | 'gold' | 'investor';
  @ApiProperty({ required: false }) @IsOptional() @IsString() couponCode?: string;
}

/**
 * Coupon créé À LA MAIN par l'admin (ex. "Coupon 1", "Coupon 2"…), indépendamment
 * du moteur IA — contenu promotionnel assumé comme tel (marché/sport libres, pas un
 * "vrai match détecté"), publié immédiatement dans le tier choisi.
 */
export class ManualPredictionDto {
  @ApiProperty() @IsString() sport!: string;
  @ApiProperty() @IsString() match!: string;
  @ApiProperty() @IsString() market!: string;
  @ApiProperty() @IsString() selection!: string;
  @ApiProperty() @IsNumber() odds!: number;
  @ApiProperty() @IsString() couponCode!: string;
  @ApiProperty({ enum: ['free', 'gold', 'investor'] }) @IsString() tier!: 'free' | 'gold' | 'investor';
  @ApiProperty({ required: false }) @IsOptional() @IsInt() reliability?: number;
}

export class SetResultDto {
  @ApiProperty({ enum: ['won', 'lost', 'void'] }) @IsString() result!: 'won' | 'lost' | 'void';
  @ApiProperty({ required: false }) @IsOptional() @IsString() note?: string;
}

@ApiTags('predictions')
@Controller('predictions')
export class PredictionsController {
  constructor(private predictions: PredictionsService) {}

  /** §A vitrine : l'unique "Cote de 2" gratuite du jour, validée par l'admin. */
  @Get('free-of-the-day')
  freeOfTheDay() {
    return this.predictions.freeOfTheDay();
  }

  /** Flux privé Gold/Investisseur : cotes agressives (5, 10, scores exacts, montantes). */
  @Get('feed')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('gold', 'investor')
  feed(@CurrentUser() user: AuthUser) {
    return this.predictions.privateFeed(user.role as 'gold' | 'investor', user.subscriptionEndsAt);
  }

  // ── Admin : création / validation manuelle ─────────────────
  @Get('pending')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  pending() {
    return this.predictions.pending();
  }

  /** Vue admin complète : données brutes IA + canal + statut. */
  @Get('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  adminList() {
    return this.predictions.adminList();
  }

  /** Performance de l'IA : taux de réussite global + par marché + par sport. */
  @Get('performance')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  performance() {
    return this.predictions.performance();
  }

  /**
   * Liste des pronostics À NOTER (clé interne) : en attente + rattachés à un match.
   * Le moteur s'en sert pour noter depuis la BASE (sans dépendre d'un fichier local).
   */
  @Get('pending-grading')
  @UseGuards(InternalKeyGuard)
  pendingGrading() {
    return this.predictions.pendingGrading();
  }

  /**
   * Mémoire d'apprentissage du moteur (clé interne). Stockée en base pour survivre aux
   * redéploiements du conteneur Python (disque non persistant sur Render/PaaS similaires).
   */
  @Get('engine-memory')
  @UseGuards(InternalKeyGuard)
  getEngineMemory() {
    return this.predictions.getEngineMemory();
  }

  @Post('engine-memory')
  @UseGuards(InternalKeyGuard)
  setEngineMemory(@Body() data: unknown) {
    return this.predictions.setEngineMemory(data);
  }

  /** Notation d'une prédiction par le moteur (clé interne) : won / lost / void. */
  @Post(':id/result')
  @UseGuards(InternalKeyGuard)
  setResult(@Param('id') id: string, @Body() dto: SetResultDto) {
    return this.predictions.setResult(id, dto.result, dto.note);
  }

  @Post(':id/validate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  validate(@Param('id') id: string) {
    return this.predictions.validate(id);
  }

  /** Pousse la prédiction sur un canal (free = ticket gratuit, gold = flux privé). */
  @Post(':id/publish')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  publish(@Param('id') id: string, @Body() dto: PublishPredictionDto) {
    return this.predictions.publish(id, dto.tier, dto.couponCode);
  }

  /** Coupon créé à la main par l'admin (indépendant du moteur IA), publié immédiatement. */
  @Post('manual')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  createManual(@Body() dto: ManualPredictionDto) {
    return this.predictions.createManual(dto);
  }

  /** Ingestion depuis le moteur d'analyse nocturne Python (clé interne). */
  @Post('ingest')
  @UseGuards(InternalKeyGuard)
  ingest(@Body() dto: IngestPredictionDto) {
    return this.predictions.ingest(dto);
  }
}
