'use client';

/** Toast doré façon maquette de référence (bas de l'écran, rebond). */
export function showToast(message: string) {
  const toast = document.createElement('div');
  toast.className =
    'fixed bottom-10 left-1/2 -translate-x-1/2 gold-gradient text-black px-6 py-3 ' +
    'rounded-full font-bold shadow-2xl z-[200] animate-bounce';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

export async function copyText(value: string, message = 'Copié !') {
  // `finally` garantit l'affichage du toast même si writeText ET le repli
  // execCommand échouent tous les deux (permission refusée, navigateur restrictif…) —
  // sans ça, une erreur dans le repli faisait disparaître toute notification.
  try {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = document.createElement('textarea');
      el.value = value;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  } finally {
    showToast(message);
  }
}
