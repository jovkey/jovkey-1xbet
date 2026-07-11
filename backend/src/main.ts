import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { UPLOAD_DIR } from './media/media.service';

async function bootstrap() {
  // Aucun secret par défaut, en dev comme en prod : on refuse de démarrer plutôt que
  // de signer les JWT avec une valeur devinable (ex: 'dev-secret').
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET manquant : définis-le dans .env (chaîne aléatoire longue).');
  }

  // rawBody: true → conserve le corps brut de la requête (req.rawBody), nécessaire
  // pour vérifier la signature HMAC du webhook FedaPay (voir payments.controller.ts).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  app.setGlobalPrefix('api');
  app.use(cookieParser());

  // CORS : le JWT vit désormais dans un cookie httpOnly (credentials: true), donc l'origine
  // NE DOIT JAMAIS être réfléchie en wildcard (sinon n'importe quel site pourrait rejouer les
  // cookies de session). FRONTEND_ORIGIN est obligatoire en production ; en dev on retombe sur
  // localhost:3000 uniquement (jamais `true`).
  // Retrait du slash final : le header Origin envoyé par le navigateur n'en a jamais
  // (ex. "https://site.vercel.app"), donc une valeur collée avec un "/" en trop ("...app/")
  // ne matcherait jamais → CORS rejetterait silencieusement toutes les requêtes credentialed.
  const origins = process.env.FRONTEND_ORIGIN?.split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  if (process.env.NODE_ENV === 'production' && (!origins || origins.length === 0)) {
    throw new Error('FRONTEND_ORIGIN manquant : obligatoire en production (cookies de session).');
  }
  app.enableCors({ origin: origins && origins.length ? origins : 'http://localhost:3000', credentials: true });

  // Fichiers média uploadés, servis publiquement sous /uploads (hors préfixe /api).
  app.useStaticAssets(UPLOAD_DIR, { prefix: '/uploads/' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const config = new DocumentBuilder()
    .setTitle('JOVKEY-1XBET API')
    .setDescription('Auth/Rôles, CMS distant, pronostics, investissements, SSE temps réel')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`JOVKEY-1XBET API → http://localhost:${port}/api  (docs: /docs)`);
}
bootstrap();
