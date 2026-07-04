import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

@ApiTags('stats')
@Controller('stats')
export class StatsController {
  constructor(private stats: StatsService) {}

  /** Tracking public, sans friction (page vue, visiteur unique, clic promo, copie coupon). */
  @Post('track')
  track(@Body() body: { type: string; path?: string; visitorId?: string; source?: string }) {
    return this.stats.track(body);
  }

  /** Tableau de bord trafic temps réel (admin). */
  @Get('overview')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  overview() {
    return this.stats.overview();
  }
}
