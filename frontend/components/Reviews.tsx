'use client';
import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { api } from '@/lib/api';
import { showToast } from '@/lib/clipboard';
import { Review } from '@/lib/types';

function Avatar({ name }: { name: string }) {
  const initials = name.replace(/[^A-Za-zÀ-ÿ ]/g, '').trim().split(' ')
    .map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <div className="w-11 h-11 rounded-full gold-gradient text-black font-black flex items-center justify-center shrink-0">
      {initials}
    </div>
  );
}

function Stars({ value, onPick }: { value: number; onPick?: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onPick}
          onClick={() => onPick?.(n)}
          className={onPick ? 'cursor-pointer' : 'cursor-default'}
          aria-label={`${n} étoiles`}
        >
          <Star size={onPick ? 26 : 16} className={n <= value ? 'fill-gold text-gold' : 'text-gray-600'} />
        </button>
      ))}
    </div>
  );
}

export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [name, setName] = useState('');
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');

  const load = () => api<Review[]>('/reviews').then(setReviews).catch(() => {});
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (name.trim().length < 2 || body.trim().length < 8) {
      return showToast('Nom et avis trop courts.');
    }
    try {
      await api('/reviews', { method: 'POST', body: { authorName: name, rating, body } });
      showToast(
        rating >= 4 ? 'Merci ! Votre avis est publié.' : 'Merci ! Votre avis est en cours d’examen.',
      );
      setName(''); setBody(''); setRating(5);
      load();
    } catch {
      showToast('Erreur lors de l’envoi.');
    }
  };

  return (
    <section className="py-20 px-4 max-w-5xl mx-auto">
      <h2 className="text-4xl font-black mb-2 text-center uppercase">
        Avis de la <span className="text-gold">communauté</span>
      </h2>
      <p className="text-gray-400 text-center mb-10 text-sm">
        Les avis 4★ et 5★ sont publiés ; les notes inférieures partent en modération.
      </p>

      {/* Défilement continu plutôt qu'une liste statique qui allonge la page à mesure
          que les avis s'accumulent — on duplique la liste pour une boucle sans coupure. */}
      {reviews.length ? (
        <div className="overflow-hidden mb-12" style={{ maskImage: 'linear-gradient(90deg, transparent, black 8%, black 92%, transparent)' }}>
          <div
            className="flex gap-5 w-max animate-marquee"
            style={{ ['--marquee-duration' as any]: `${Math.max(20, reviews.length * 6)}s` }}
          >
            {[...reviews, ...reviews].map((r, i) => (
              <div key={`${r.id}-${i}`} className="glass rounded-2xl p-5 flex gap-4 w-80 shrink-0">
                <Avatar name={r.authorName} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{r.authorName}</span>
                    {r.isSeed && (
                      <span className="text-[9px] uppercase tracking-widest bg-white/10 text-gray-400 px-2 py-0.5 rounded">
                        Démo
                      </span>
                    )}
                  </div>
                  <Stars value={r.rating} />
                  <p className="text-gray-400 text-sm mt-2 line-clamp-3">{r.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-gray-500 text-sm text-center mb-12">Aucun avis publié pour l’instant.</p>
      )}

      <div className="glass rounded-3xl p-6 max-w-xl mx-auto">
        <h3 className="text-xl font-black mb-4">Laisser un avis</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Votre nom"
          className="w-full glass rounded-xl px-4 mb-3 tap-target outline-none focus:border-gold"
        />
        <div className="mb-3"><Stars value={rating} onPick={setRating} /></div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Votre expérience…"
          rows={3}
          className="w-full glass rounded-xl px-4 py-3 mb-4 outline-none focus:border-gold"
        />
        <button
          onClick={submit}
          className="w-full gold-gradient text-black rounded-xl font-black tap-target hover:scale-[1.02] transition"
        >
          Publier mon avis
        </button>
      </div>
    </section>
  );
}
