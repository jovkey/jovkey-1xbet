import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

/** Protège les endpoints internes consommés par le moteur d'analyse Python. */
@Injectable()
export class InternalKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.ANALYSIS_API_KEY;
    if (!expected) {
      // Pas de repli faible en dur : sans clé configurée, on refuse tout plutôt que
      // d'accepter une valeur devinable.
      throw new UnauthorizedException('ANALYSIS_API_KEY non configurée côté backend.');
    }
    const req = context.switchToHttp().getRequest();
    const key = req.headers['x-internal-key'];
    if (!key || key !== expected) {
      throw new UnauthorizedException('Clé interne invalide');
    }
    return true;
  }
}
