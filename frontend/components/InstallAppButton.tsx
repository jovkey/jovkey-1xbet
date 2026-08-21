'use client';
import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

/**
 * Bouton flottant « Installer l'appli » (PWA). Ajoute l'icône « Coupon Gratuit » sur
 * l'écran d'accueil du téléphone → l'utilisateur relance le site en un tap, en plein écran.
 *
 * - Android / Chrome : on capture l'évènement `beforeinstallprompt`, et le clic déclenche
 *   la vraie fenêtre d'installation native.
 * - iPhone / Safari : iOS ne fournit pas cet évènement → on affiche les étapes manuelles
 *   (Partager → « Sur l'écran d'accueil »).
 * - Déjà installée (mode standalone) : on n'affiche rien.
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
    // Déjà installée / lancée depuis l'écran d'accueil → inutile de proposer.
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
      setVisible(false);
    } else if (isIOS) {
      setShowIosHelp(true);
    }
  };

  if (!visible) return null;

  return (
    <>
      <button
        onClick={handleClick}
        className="fixed z-[250] bottom-4 left-4 gold-gradient text-black px-4 py-2.5 rounded-full font-black text-sm shadow-2xl flex items-center gap-2 tap-target hover:scale-105 transition"
        aria-label="Installer l'application"
      >
        <Download size={16} /> Installer l&apos;appli
      </button>

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
