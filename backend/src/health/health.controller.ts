import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Sonde de vie appelée périodiquement par un ping externe (GitHub Actions) pour
 * empêcher la base Neon (auto-suspend après 5 min d'inactivité) et le service
 * Render de s'endormir entre deux visites réelles — sinon le premier client à
 * arriver essuie une inscription/connexion en erreur pendant le réveil à froid.
 */
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, time: new Date().toISOString() };
  }
}
