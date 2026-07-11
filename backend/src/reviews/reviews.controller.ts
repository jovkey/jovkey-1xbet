import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser, AuthUser } from '../common/current-user.decorator';

export class CreateReviewDto {
  @ApiProperty({ example: 'Awa K.' })
  @IsString()
  @MinLength(2)
  authorName!: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  body!: string;

  @ApiProperty({ required: false, description: 'userId si membre connecté' })
  @IsOptional()
  @IsString()
  userId?: string;
}

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private reviews: ReviewsService) {}

  /** Avis visibles du public : uniquement les avis publiés. */
  @Get()
  listPublic() {
    return this.reviews.listPublished();
  }

  /**
   * Déposer un avis. ≥4★ → publié immédiatement. <4★ → file de modération admin
   * (non supprimé : l'admin en garde la trace et décide).
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  create(@Body() dto: CreateReviewDto) {
    return this.reviews.create(dto);
  }

  // ── Modération admin ──────────────────────────────────────────
  @Get('moderation')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  moderationQueue() {
    return this.reviews.listPending();
  }

  @Post(':id/publish')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  publish(@Param('id') id: string) {
    return this.reviews.setStatus(id, 'published');
  }

  @Post(':id/reject')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  reject(@Param('id') id: string) {
    return this.reviews.setStatus(id, 'rejected');
  }

  /** Vue admin complète (publiés inclus) — pour repérer un avis à supprimer. */
  @Get('admin')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  listAll() {
    return this.reviews.listAll();
  }

  /** Suppression définitive d'un avis (ex. publié par erreur, spam…). */
  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.reviews.remove(id);
  }

  /** Seeding : injecte des avis de démonstration pour asseoir la crédibilité au lancement. */
  @Post('seed')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  seed() {
    return this.reviews.seedDemo();
  }

  /** Compteur d'avis du membre (gate des 5 avis pour les investisseurs). */
  @Get('me/count')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  myCount(@CurrentUser() user: AuthUser) {
    return this.reviews.countForUser(user.id);
  }
}
