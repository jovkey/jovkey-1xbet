import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

function currentCycle(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Mot de passe aléatoire lisible (~12 caractères) — jamais de valeur fixe en dur. */
function randomPassword(): string {
  return randomBytes(9).toString('base64url');
}

// Surchageables via .env pour un run reproductible (ex. CI) ; sinon générés aléatoirement
// à chaque exécution et affichés une seule fois en fin de script.
const passwords = {
  superadmin: process.env.SUPERADMIN_BOOTSTRAP_PASSWORD || randomPassword(),
  gold: process.env.SEED_GOLD_PASSWORD || randomPassword(),
  investor: process.env.SEED_INVESTOR_PASSWORD || randomPassword(),
  goldPending: process.env.SEED_GOLD_PENDING_PASSWORD || randomPassword(),
};

async function main() {
  // Ce script insère des comptes ET DES PRONOSTICS DE DÉMONSTRATION (matchs fictifs,
  // ex. "Lakers vs Suns") — jamais rattachés à un vrai match Sofascore. Exécuté par
  // erreur une fois contre la base de prod (unique base partagée dev/prod de ce projet,
  // cf. DATABASE_URL), ces faux pronostics sont restés visibles des mois dans le flux
  // Gold/Investisseur payant avant d'être repérés. Même garde-fou que ALLOW_MOCK_PROVIDER
  // côté moteur Python : on refuse de démarrer sans confirmation explicite.
  if (process.env.ALLOW_DEV_SEED !== 'true') {
    throw new Error(
      'seed.ts refusé : ce script insère des pronostics FICTIFS (démo). ' +
        'Sur une base de production, utilise `npm run seed:prod` à la place. ' +
        'Pour du dev local uniquement, relance avec ALLOW_DEV_SEED=true explicite.',
    );
  }
  const cycle = currentCycle();

  // ── Comptes (connexion par EMAIL) ──────────────────────────
  await prisma.user.upsert({
    where: { email: 'superadmin@jovkey.local' },
    update: {},
    create: {
      email: 'superadmin@jovkey.local',
      passwordHash: await bcrypt.hash(passwords.superadmin, 10),
      role: 'superadmin',
      statusFlash: 'approved',
    },
  });

  await prisma.user.upsert({
    where: { email: 'gold@jovkey.local' },
    update: {},
    create: {
      email: 'gold@jovkey.local',
      passwordHash: await bcrypt.hash(passwords.gold, 10),
      role: 'gold',
      statusFlash: 'approved',
      communityLinkSent: true,
    },
  });

  const investor = await prisma.user.upsert({
    where: { email: 'investor@jovkey.local' },
    update: {
      balanceWithdrawable: 30000,
      balanceUnderAnalysis: 25000,
      balanceFrozen: 300000,
    },
    create: {
      email: 'investor@jovkey.local',
      passwordHash: await bcrypt.hash(passwords.investor, 10),
      role: 'investor',
      accountStatus: 'active',
      country: 'Togo',
      statusFlash: 'approved',
      reviewsWritten: 2,
      lastInvestmentDate: new Date('2026-01-15'),
      balanceWithdrawable: 30000,
      balanceUnderAnalysis: 25000,
      balanceFrozen: 300000,
    },
  });

  await prisma.investment.deleteMany({ where: { userId: investor.id, cycleMonth: cycle } });
  await prisma.investment.create({
    data: { userId: investor.id, capital: 300000, cycleMonth: cycle, pnl: 42000, status: 'active' },
  });

  // ── Données de démo pour le panel admin (à valider) ────────
  await prisma.payment.deleteMany();
  await prisma.withdrawal.deleteMany();

  // Recharge investisseur en attente (correspond au solde « sous analyse »).
  await prisma.payment.create({
    data: {
      userId: investor.id, amount: 25000, currency: 'XOF', method: 'mtn',
      purpose: 'investor_deposit', status: 'pending', reference: 'momo-ref-002',
    },
  });
  // Retrait investisseur en attente (réservé sur le retirable : 30000 dispo + 20000 réservé).
  await prisma.withdrawal.create({
    data: {
      userId: investor.id, amount: 20000, method: 'mtn',
      destination: 'momo-ref-002', status: 'pending',
    },
  });

  // Inscription Gold en attente de paiement (à activer depuis le panel).
  const goldPending = await prisma.user.upsert({
    where: { email: 'goldpend@jovkey.local' },
    update: { accountStatus: 'pending_payment' },
    create: {
      email: 'goldpend@jovkey.local',
      passwordHash: await bcrypt.hash(passwords.goldPending, 10),
      role: 'gold',
      accountStatus: 'pending_payment',
      country: 'Togo',
      statusFlash: 'approved',
    },
  });
  await prisma.payment.create({
    data: {
      userId: goldPending.id, amount: 5600, currency: 'XOF', method: 'moov',
      purpose: 'gold_subscription', status: 'pending', reference: 'momo-ref-001',
    },
  });

  // ── Courbe de performance du mois ──────────────────────────
  await prisma.performancePoint.deleteMany({ where: { cycleMonth: cycle } });
  let pct = 0;
  for (let i = 1; i <= 20; i++) {
    pct += Math.round((Math.random() * 4 - 1) * 100) / 100; // dérive légèrement positive
    await prisma.performancePoint.create({
      data: {
        cycleMonth: cycle,
        day: new Date(`${cycle}-${String(i).padStart(2, '0')}T12:00:00Z`),
        bankrollPct: Number(pct.toFixed(2)),
      },
    });
  }

  // ── CMS : réglages, carrousel, marquee ─────────────────────
  await prisma.cmsSetting.upsert({
    where: { key: 'tutorial_video' },
    update: {},
    create: {
      key: 'tutorial_video',
      value: { provider: 'youtube', embedId: 'dQw4w9WgXcQ' },
    },
  });
  await prisma.cmsSetting.upsert({
    where: { key: 'promo_code' },
    update: {},
    create: { key: 'promo_code', value: { code: 'JOVKEY', bonusPct: 200 } },
  });
  await prisma.cmsSetting.upsert({
    where: { key: 'gold_price' },
    update: {},
    create: { key: 'gold_price', value: { amount: 5600, currency: 'XOF' } },
  });

  await prisma.marqueeMessage.deleteMany();
  for (const [i, text] of [
    'CODE PROMO : JOVKEY (+200% BONUS)',
    'Alerte IA : gros coup détecté sur le Hockey 🏒',
    'Rejoins le VIP pour des cotes agressives validées',
  ].entries()) {
    await prisma.marqueeMessage.create({ data: { text, position: i } });
  }

  await prisma.carouselSlide.deleteMany();
  for (const [i, slide] of [
    { imageUrl: 'https://picsum.photos/seed/jovkey1/1200/500', caption: 'Bonus 200% avec JOVKEY', linkTunnel: 'flash' },
    { imageUrl: 'https://picsum.photos/seed/jovkey2/1200/500', caption: 'Pack Gold Elite', linkTunnel: 'gold' },
    { imageUrl: 'https://picsum.photos/seed/jovkey3/1200/500', caption: 'Pack Investisseur Pro', linkTunnel: 'investor' },
  ].entries()) {
    await prisma.carouselSlide.create({ data: { ...slide, position: i } });
  }

  // ── Pronostics ─────────────────────────────────────────────
  await prisma.prediction.deleteMany();
  await prisma.prediction.create({
    data: {
      sport: 'football', match: 'Real Madrid vs Getafe', market: 'Cote 2',
      selection: 'Real Madrid -1.5', odds: 2.05, reliability: 88,
      couponCode: 'JOV-FREE-2205', tier: 'free', isValidated: true, valueScore: 0.14,
      analysis: {
        enjeu: 'Liga — course au titre',
        formeDomicile: ['V', 'V', 'N', 'V', 'V'],
        cotesNiche: { tirsCadres: 1.9, corners: 2.1, cartons: 2.4 },
        arbitre: { nom: 'M. Sanchez', moyenneCartons: 4.2, penaltysAccordes: 0.3 },
        proba_ia: 0.61, cote_reelle_1xbet: 2.05,
      },
    },
  });
  // Prédictions NON validées, SANS code coupon (telles que poussées par l'IA).
  // L'IA ne fournit que des statistiques ; l'admin lit et ajoute le code au push.
  await prisma.prediction.create({
    data: {
      sport: 'football', match: 'Arsenal vs Chelsea', market: 'Analyse complète',
      selection: 'Voir statistiques', odds: 1.95, reliability: 79,
      couponCode: '', tier: 'free', isValidated: false, valueScore: 0.08,
      analysis: {
        enjeu: 'Premier League — derby londonien',
        resultat_1x2: { domicile: '52%', nul: '24%', exterieur: '24%' },
        score_exact_probable: ['2-1', '1-1', '2-0'],
        plus_de_2_5_buts: '61%',
        les_deux_marquent: '58%',
        corners_estimes: '9-11 (over 8.5 conseillé)',
        tirs_cadres: 'Arsenal ~6, Chelsea ~4',
        cartons: 'moyenne 4.8 — arbitre strict',
        hors_jeu: 'Arsenal 2, Chelsea 3',
        arbitre: { nom: 'A. Taylor', moyenne_cartons: 5.1, penaltys: 0.4 },
        forme_domicile: ['V', 'V', 'N', 'V', 'D'],
        commentaire: 'Domination attendue d’Arsenal à domicile, match ouvert. Value sur over 2.5 + corners.',
      },
    },
  });
  await prisma.prediction.create({
    data: {
      sport: 'basketball', match: 'Lakers vs Celtics', market: 'Analyse complète',
      selection: 'Voir statistiques', odds: 1.9, reliability: 73,
      couponCode: '', tier: 'gold', isValidated: false, valueScore: 0.11,
      analysis: {
        vainqueur_probable: 'Celtics (58%)',
        total_points_estime: '218 (over 215.5 conseillé)',
        ecart_estime: 'Celtics -3.5',
        meilleur_marqueur_probable: 'Tatum 28+ pts',
        plus_de_3pts_equipe: 'Celtics ~15 paniers à 3pts',
        commentaire: 'Rythme élevé attendu, défense des Lakers fragile à l’extérieur.',
      },
    },
  });
  await prisma.prediction.create({
    data: {
      sport: 'hockey', match: 'Maple Leafs vs Bruins', market: 'Analyse complète',
      selection: 'Voir statistiques', odds: 2.1, reliability: 70,
      couponCode: '', tier: 'gold', isValidated: false, valueScore: 0.05,
      analysis: {
        vainqueur_probable: 'Bruins (54%)',
        total_buts_estime: 'over 5.5',
        tirs_cadres: 'Bruins ~33, Leafs ~29',
        commentaire: 'Match physique, gardien des Bruins en forme.',
      },
    },
  });
  await prisma.prediction.createMany({
    data: [
      { sport: 'basketball', match: 'Lakers vs Suns', market: 'Cote 5', selection: 'Combiné Over', odds: 5.2, reliability: 71, couponCode: 'JOV-G-5201', tier: 'gold', isValidated: true, valueScore: 0.22 },
      { sport: 'tennis_table', match: 'Ma Long vs Fan Z.', market: 'Score exact', selection: '3-1', odds: 4.4, reliability: 64, couponCode: 'JOV-G-3104', tier: 'gold', isValidated: true, valueScore: 0.19 },
      { sport: 'hockey', match: 'Maple Leafs vs Bruins', market: 'Montante (étape 2)', selection: 'Leafs ML', odds: 2.3, reliability: 76, couponCode: 'JOV-I-2302', tier: 'investor', isValidated: true, valueScore: 0.17 },
    ],
  });

  // ── Avis de démonstration (CONTENU DE TEMPLATE, marqués is_seed) ──
  // Ne PAS présenter ces avis comme de vrais clients en production.
  await prisma.review.deleteMany({ where: { isSeed: true } });
  await prisma.review.createMany({
    data: [
      { authorName: 'Exemple — Awa K.', rating: 5, body: 'Avis de démonstration (template). Interface claire et rapide.', status: 'published', isSeed: true },
      { authorName: 'Exemple — Yann T.', rating: 4, body: 'Avis de démonstration (template). Bon suivi des coupons.', status: 'published', isSeed: true },
      // Avis réellement attribués à INV001 → cohérence du compteur (gate 5 avis).
      { userId: investor.id, authorName: 'INV001', rating: 5, body: 'Suivi de capital transparent, je recommande.', status: 'published', isSeed: true },
      { userId: investor.id, authorName: 'INV001', rating: 4, body: 'Bonne gestion, reporting clair chaque semaine.', status: 'published', isSeed: true },
    ],
  });
  // Aligne le compteur dénormalisé sur le nombre réel d'avis écrits par INV001.
  const inv001Reviews = await prisma.review.count({ where: { userId: investor.id } });
  await prisma.user.update({
    where: { id: investor.id },
    data: { reviewsWritten: inv001Reviews },
  });

  // Affiché UNE SEULE FOIS ici (le hash bcrypt en base est à sens unique) — à noter
  // immédiatement si tu comptes te connecter avec ces comptes de démo.
  // eslint-disable-next-line no-console
  console.log(
    [
      'Seed terminé ✓ — identifiants de démo (générés aléatoirement à chaque exécution) :',
      `  superadmin@jovkey.local   / ${passwords.superadmin}`,
      `  gold@jovkey.local         / ${passwords.gold}`,
      `  investor@jovkey.local     / ${passwords.investor}`,
      `  goldpend@jovkey.local     / ${passwords.goldPending}`,
    ].join('\n'),
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
