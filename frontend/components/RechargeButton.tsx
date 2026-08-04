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
        'glass px-5 py-2.5 rounded-lg font-bold text-sm hover:bg-white/10 transition tap-target ' +
        'flex items-center justify-center gap-2 border border-gold/30 text-gold ' +
        className
      }
    >
      <Icon size={16} /> {label}
    </button>
  );
}
