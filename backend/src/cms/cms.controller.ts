import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CmsService } from './cms.service';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

@ApiTags('cms')
@Controller('cms')
export class CmsController {
  constructor(private cms: CmsService) {}

  // ── Public (lecture pour le frontend) ─────────────────────────
  @Get('public')
  publicConfig() {
    return this.cms.getPublicConfig();
  }

  // ── Carrousel ─────────────────────────────────────────────────
  @Post('carousel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  addSlide(@Body() body: { imageUrl: string; caption?: string; linkTunnel?: string }) {
    return this.cms.addSlide(body);
  }

  @Put('carousel/reorder')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  reorder(@Body() body: { orderedIds: string[] }) {
    return this.cms.reorderSlides(body.orderedIds);
  }

  @Delete('carousel/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  deleteSlide(@Param('id') id: string) {
    return this.cms.deleteSlide(id);
  }

  // ── Marquee ───────────────────────────────────────────────────
  @Post('marquee')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  addMarquee(@Body() body: { text: string }) {
    return this.cms.addMarquee(body.text);
  }

  @Put('marquee/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  editMarquee(@Param('id') id: string, @Body() body: { text?: string; active?: boolean }) {
    return this.cms.editMarquee(id, body);
  }

  @Delete('marquee/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  deleteMarquee(@Param('id') id: string) {
    return this.cms.deleteMarquee(id);
  }

  // ── Réglages (vidéo tuto, code promo) ─────────────────────────
  @Put('settings/:key')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  setSetting(@Param('key') key: string, @Body() body: { value: unknown }) {
    return this.cms.setSetting(key, body.value);
  }
}
