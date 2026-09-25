'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun, Cloud } from 'lucide-react';

export type Theme = 'dark' | 'light' | 'sky';

const STORAGE_KEY = 'jovkey_theme';
const THEME_COLORS: Record<Theme, string> = { dark: '#0f172a', light: '#f8fafc', sky: '#e0f2fe' };

const OPTIONS: { id: Theme; label: string; icon: typeof Moon; swatch: string }[] = [
  { id: 'dark', label: 'Sombre', icon: Moon, swatch: 'bg-slate-900 !text-white' },
  { id: 'light', label: 'Blanc', icon: Sun, swatch: 'bg-white text-slate-900' },
  { id: 'sky', label: 'Bleu ciel', icon: Cloud, swatch: 'bg-sky-300 text-slate-900' },
];

function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[t]);
}

/** Choix du thème du site (sombre / blanc / bleu ciel), mémorisé sur l'appareil. */
export default function ThemeSwitcher({ showLabels = false }: { showLabels?: boolean }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme') as Theme | null;
    if (current === 'light' || current === 'sky' || current === 'dark') setTheme(current);
  }, []);

  const choose = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* navigation privée : le thème vaut pour la session seulement */
    }
  };

  return (
    <div role="group" aria-label="Thème du site" className="flex items-center gap-2">
      {OPTIONS.map(({ id, label, icon: Icon, swatch }) => {
        const active = theme === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => choose(id)}
            aria-label={`Thème ${label}`}
            aria-pressed={active}
            title={label}
            className={`${swatch} rounded-full border-2 transition inline-flex items-center justify-center gap-2 ${
              showLabels ? 'px-2 h-11 text-sm font-bold flex-1 whitespace-nowrap' : 'w-8 h-8'
            } ${active ? 'border-gold ring-2 ring-gold/40' : 'border-gray-500/50 opacity-80 hover:opacity-100'}`}
          >
            <Icon size={showLabels ? 18 : 15} />
            {showLabels && label}
          </button>
        );
      })}
    </div>
  );
}
