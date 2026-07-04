'use client';
import { PAYMENT_METHODS, PayMethodId } from '@/lib/config';

interface Props {
  method: PayMethodId;
  reference: string;
  onMethod: (m: PayMethodId) => void;
  onReference: (r: string) => void;
}

/** Sélecteur de moyen de paiement (mobile money local + carte + PayPal). */
export default function PaymentMethodPicker({ method, reference, onMethod, onReference }: Props) {
  const current = PAYMENT_METHODS.find((m) => m.id === method) || PAYMENT_METHODS[0];
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest text-gray-400 mb-2">
        Moyen de paiement
      </label>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {PAYMENT_METHODS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onMethod(m.id)}
            className={`rounded-xl py-3 px-2 text-xs font-bold border transition flex flex-col items-center gap-1 ${
              method === m.id
                ? 'gold-gradient text-black border-transparent'
                : 'glass border-white/10 hover:bg-white/10'
            }`}
          >
            <span className="text-lg leading-none">{m.emoji}</span>
            {m.label}
          </button>
        ))}
      </div>
      <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">
        {current.refLabel}
      </label>
      <input
        value={reference}
        onChange={(e) => onReference(e.target.value)}
        placeholder={current.refPlaceholder}
        className="w-full glass rounded-xl px-4 tap-target outline-none focus:border-gold"
      />
    </div>
  );
}
