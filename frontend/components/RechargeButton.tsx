'use client';
import { Wallet, ArrowDownToLine } from 'lucide-react';
import { openRecharge, RechargeMode } from '@/lib/recharge';

/**
 * Bouton public « Recharger mon compte » / « Faire un retrait ». Le formulaire est caché :
 * il n'apparaît qu'au clic (ouvre <RechargeModal/> monté globalement dans le layout).
 */
export default function RechargeButton({
  mode = 'deposit',
  className = '',
}: {
  mode?: RechargeMode;
  className?: string;
}) {
  const isWithdraw = mode === 'withdraw';
  const Icon = isWithdraw ? ArrowDownToLine : Wallet;
  const label = isWithdraw ? 'FAIRE UN RETRAIT' : 'RECHARGER MON COMPTE';

  return (
    <button
      onClick={() => openRecharge(mode)}
      className={
        'glass px-3.5 py-1.5 rounded-lg font-semibold text-xs hover:bg-white/10 transition ' +
        'flex items-center justify-center gap-1.5 border border-gold/30 text-gold ' +
        className
      }
    >
      <Icon size={14} /> {label}
    </button>
  );
}
