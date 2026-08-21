'use client';
import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

/**
 * Bouton flottant « Installer l'appli » (PWA). Ajoute l'icône « Coupon Gratuit » sur
 * l'écran d'accueil du téléphone → l'utilisateur relance le site en un tap, en plein écran.
 *
 * - Android / Chrome : `beforeinstallprompt` capturé → le clic ouvre la fenêtre native
 *   d'installation (vraie appli WebAPK, grâce au service worker enregistré dans PwaRegister).
 * - iPhone / Safari : pas d'évènement natif → on affiche les étapes manuelles.
 * - Déjà installée, ou masquée par l'utilisateur → on n'affiche plus rien (mémorisé).
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const HIDDEN_KEY = 'pwa_install_hidden';

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
    // Déjà installée ou masquée volontairement lors d'une visite précédente.
    try { if (localStorage.getItem(HIDDEN_KEY) === '1') return; } catch { /* localStorage indispo */ }

    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIOS(ios);

    const onPrompt = (e: Event) => {
      e.preventDefault(); // on garde la main pour déclencher au clic
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      try { localStorage.setItem(HIDDEN_KEY, '1'); } catch { /* ignore */ }
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    // iOS ne déclenche jamais beforeinstallprompt : on montre quand même le bouton (aide manuelle).
    if (ios) setVisible(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const remember = () => { try { localStorage.setItem(HIDDEN_KEY, '1'); } catch { /* ignore */ } };

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      try {
        const { outcome } = await deferred.userChoice;
        if (outcome === 'accepted') remember(); // installée → ne plus reproposer
      } catch { /* peu importe */ }
      setDeferred(null);
      setVisible(false);
    } else if (isIOS) {
      setShowIosHelp(true);
    }
  };

  // Croix : l'utilisateur masque le bouton définitivement (il pourra toujours installer
  // via le menu de Chrome « Installer l'application »).
  const dismiss = () => { remember(); setVisible(false); };

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
