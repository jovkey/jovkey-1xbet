import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  /**
   * Connexion résiliente : on tente quelques fois (utile pour réveiller une base
   * serverless comme Neon qui se met en veille), mais on ne fait PAS planter l'app
   * si la base est encore froide — Prisma se reconnectera au premier appel.
   */
  async onModuleInit() {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Connecté à la base de données ✓');
        return;
      } catch (err) {
        this.logger.warn(
          `Connexion DB échouée (tentative ${attempt}/${maxAttempts}). Nouvel essai…`,
        );
        if (attempt === maxAttempts) {
          this.logger.warn(
            'Base injoignable au démarrage — l\'app démarre quand même, ' +
              'la connexion se fera au premier appel (réveil Neon).',
          );
          return; // ne pas crasher : connexion paresseuse au premier query
        }
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }
  }
}
