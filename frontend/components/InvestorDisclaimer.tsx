'use client';
import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';

const DEFAULT_PITCH =
  "Faites travailler votre capital comme un professionnel. Vous n'avez pas le temps d'analyser " +
  "les matchs ? Vous voulez éviter les pièges émotionnels du jeu ? Le Pack Investisseur vous " +
  "permet de déléguer la gestion de vos mises à notre équipe d'experts et à notre algorithme prédictif.";

export default function InvestorDisclaimer() {
  const [pitch, setPitch] = useState(DEFAULT_PITCH);
  const [legal, setLegal] = useState('');

  useEffect(() => {
    api('/cms/public').then((c: any) => {
      if (c.settings?.investor_pitch?.text) setPitch(c.settings.investor_pitch.text);
      if (c.settings?.legal_investor?.text) setLegal(c.settings.legal_investor.text);
    }).catch(() => {});
  }, []);

  return (
    <section className="py-16 px-6 max-w-4xl mx-auto">
      <div className="glass rounded-3xl p-8 border border-gold/20">
        <div className="flex items-center gap-3 mb-4">
          <ShieldAlert className="text-gold" />
          <h2 className="text-2xl font-black uppercase">
            Pack Investisseur — La gestion d&apos;élite par JOVKEY-1XBET
          </h2>
        </div>
        <p className="text-gray-300 mb-5 whitespace-pre-line">{pitch}</p>

        <h3 className="font-black text-gold mb-2">Règles et conditions de participation</h3>
        {legal ? (
          <p className="text-sm text-gray-400 whitespace-pre-line">{legal}</p>
        ) : (
          <ul className="space-y-3 text-sm text-gray-400">
            <li>
              <b className="text-white">Transparence totale :</b> en investissant, vous reconnaissez
              et acceptez que le risque zéro n&apos;existe pas. Les gains, tout comme les pertes de
              capital, font partie des réalités des marchés sportifs.
            </li>
            <li>
              <b className="text-white">Responsabilité partagée :</b> l&apos;administration déploie une
              gestion des risques (Stop-Loss) pour protéger vos fonds, mais ne pourra en aucun cas
              être tenue responsable d&apos;une perte partielle ou totale du capital déposé. Vous
              investissez uniquement un montant que vous êtes prêt à engager.
            </li>
          </ul>
        )}

        <p className="mt-6 text-[11px] text-gray-500 border-t border-white/10 pt-4">
          Aucune performance passée ne garantit un résultat futur. Ce produit ne constitue pas un
          conseil en investissement financier réglementé. Jouez de manière responsable.
        </p>
      </div>
    </section>
  );
}
