/**
 * Seed de PRODUCTION : crée UNIQUEMENT le compte superadmin (aucune donnée de démo).
 * Réglages via .env : SUPERADMIN_EMAIL, SUPERADMIN_BOOTSTRAP_PASSWORD.
 *   npm run seed:prod
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SUPERADMIN_EMAIL || 'admin@jovkey.local').toLowerCase();
  const password = process.env.SUPERADMIN_BOOTSTRAP_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error('SUPERADMIN_BOOTSTRAP_PASSWORD manquant ou trop court (≥ 8 caractères).');
  }
  await prisma.user.upsert({
    where: { email },
    update: { role: 'superadmin', accountStatus: 'active' },
    create: {
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: 'superadmin',
      accountStatus: 'active',
      statusFlash: 'approved',
    },
  });
  // Réglages CMS de base (le reste se configure depuis le panel).
  await prisma.cmsSetting.upsert({
    where: { key: 'promo_code' }, update: {},
    create: { key: 'promo_code', value: { code: 'JOVKEY', bonusPct: 200 } },
  });
  await prisma.cmsSetting.upsert({
    where: { key: 'gold_price' }, update: {},
    create: { key: 'gold_price', value: { amount: 5600, currency: 'XOF' } },
  });
  // eslint-disable-next-line no-console
  console.log(`Seed PROD terminé ✓  superadmin = ${email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
