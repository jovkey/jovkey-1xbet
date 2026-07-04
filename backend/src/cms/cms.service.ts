import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';

@Injectable()
export class CmsService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeService,
  ) {}

  private pushUpdate() {
    this.realtime.emit({ type: 'cms.updated', data: { at: Date.now() } });
  }

  /** Tout ce dont le frontend a besoin pour s'auto-piloter : carrousel, marquee, vidéo, promo. */
  async getPublicConfig() {
    const [slides, marquee, settings] = await Promise.all([
      this.prisma.carouselSlide.findMany({
        where: { active: true },
        orderBy: { position: 'asc' },
      }),
      this.prisma.marqueeMessage.findMany({
        where: { active: true },
        orderBy: { position: 'asc' },
      }),
      this.prisma.cmsSetting.findMany(),
    ]);

    const settingsMap: Record<string, unknown> = {};
    for (const s of settings) settingsMap[s.key] = s.value;

    return { slides, marquee, settings: settingsMap };
  }

  // ── Carrousel ──────────────────────────────────────────────
  async addSlide(body: { imageUrl: string; caption?: string; linkTunnel?: string }) {
    const max = await this.prisma.carouselSlide.aggregate({ _max: { position: true } });
    const slide = await this.prisma.carouselSlide.create({
      data: {
        imageUrl: body.imageUrl,
        caption: body.caption,
        linkTunnel: body.linkTunnel ?? 'flash',
        position: (max._max.position ?? -1) + 1,
      },
    });
    this.pushUpdate();
    return slide;
  }

  async reorderSlides(orderedIds: string[]) {
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.carouselSlide.update({ where: { id }, data: { position: index } }),
      ),
    );
    this.pushUpdate();
    return { ok: true };
  }

  async deleteSlide(id: string) {
    await this.prisma.carouselSlide.delete({ where: { id } });
    this.pushUpdate();
    return { ok: true };
  }

  // ── Marquee ────────────────────────────────────────────────
  async addMarquee(text: string) {
    const max = await this.prisma.marqueeMessage.aggregate({ _max: { position: true } });
    const msg = await this.prisma.marqueeMessage.create({
      data: { text, position: (max._max.position ?? -1) + 1 },
    });
    this.pushUpdate();
    return msg;
  }

  async editMarquee(id: string, body: { text?: string; active?: boolean }) {
    const msg = await this.prisma.marqueeMessage.update({ where: { id }, data: body });
    this.pushUpdate();
    return msg;
  }

  async deleteMarquee(id: string) {
    await this.prisma.marqueeMessage.delete({ where: { id } });
    this.pushUpdate();
    return { ok: true };
  }

  // ── Réglages ───────────────────────────────────────────────
  async setSetting(key: string, value: unknown) {
    const setting = await this.prisma.cmsSetting.upsert({
      where: { key },
      update: { value: value as object },
      create: { key, value: value as object },
    });
    this.pushUpdate();
    return setting;
  }
}
