'use client';
import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

/**
 * Bouton flottant « Installer l'appli » (PWA). Ajoute l'icône « Coupon Gratuit » sur
 * l'écran d'accueil du téléphone → l'utilisateur relance le site en un tap, en plein écran.
 *
 * Affichage AUTO-ADAPTATIF (aucun masquage permanent) :
 * - Déjà lancée en mode appli (standalone) → jamais affiché.
 * - Android / Chrome : affiché uniquement quand `beforeinstallprompt` se déclenche, c'est-à-dire
 *   quand l'appli N'EST PAS installée. Une fois installée, Chrome cesse d'émettre l'évènement →
 *   le bouton disparaît tout seul ; si l'utilisateur DÉSINSTALLE, l'évènement revient → le
 *   bouton réapparaît. Une nouvelle personne le voit donc toujours.
 * - iPhone / Safari : pas d'évènement natif → on l'affiche et le clic montre les étapes manuelles.
 * - La croix ✕ masque seulement pour la visite en cours (il revient au prochain passage).
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallAppButton() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    // Déjà lancée en mode appli (standalone) → inutile de proposer l'installation.
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIOS(ios);

    const onPrompt = (e: Event) => {
      e.preventDefault(); // on garde la main pour déclencher au clic
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    // Installée pendant la session → on cache (Chrome ne réémettra plus l'évènement).
    const onInstalled = () => { setVisible(false); setDeferred(null); };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    // iOS ne déclenche jamais beforeinstallprompt : on montre quand même le bouton (aide manuelle).
    if (ios) setVisible(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      try { await deferred.userChoice; } catch { /* peu importe le choix */ }
      setDeferred(null);
      setVisible(false); // l'évènement appinstalled confirmera si besoin
    } else if (isIOS) {
      setShowIosHelp(true);
    }
  };

  // Croix : masque seulement pour la visite en cours (revient au prochain passage).
  const dismiss = () => setVisible(false);

  if (!visible) return null;

  return (
    <>
      <div className="fixed z-[250] bottom-4 left-4 flex items-center gap-1">
        <button
          onClick={handleClick}
          className="gold-gradient text-black px-4 py-2.5 rounded-full font-black text-sm shadow-2xl flex items-center gap-2 tap-target hover:scale-105 transition"
          aria-label="Installer l'application"
        >
          <Download size={16} /> Installer l&apos;appli
        </button>
        <button
          onClick={dismiss}
          aria-label="Masquer"
          className="glass rounded-full p-1.5 shadow-lg text-gray-300 hover:text-white tap-target"
        >
          <X size={14} />
        </button>
      </div>

      {showIosHelp && (
        <div
          className="fixed inset-0 z-[320] flex items-end justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowIosHelp(false)}
        >
          <div
            className="glass w-full max-w-sm rounded-3xl p-6 border border-gold/30 mb-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-gold">Installer sur iPhone</h3>
              <button onClick={() => setShowIosHelp(false)} aria-label="Fermer" className="glass rounded-lg p-1.5">
                <X size={16} />
              </button>
            </div>
            <ol className="text-sm text-gray-200 space-y-2 list-decimal list-inside">
              <li>Appuie sur <b>Partager</b> <Share size={14} className="inline align-text-bottom" /> en bas de Safari.</li>
              <li>Choisis <b>« Sur l&apos;écran d&apos;accueil »</b>.</li>
              <li>Valide avec <b>Ajouter</b> — l&apos;icône <b>Coupon Gratuit</b> apparaît sur ton écran.</li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
