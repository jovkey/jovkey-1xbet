import { Send, MessageCircle, Lock } from 'lucide-react';
import CommunityCta from './CommunityCta';

export default function Community() {
  return (
    <section id="community" className="py-20 bg-slate-900/50 px-6">
      <div className="max-w-5xl mx-auto glass p-10 rounded-3xl flex flex-col md:flex-row items-center gap-10">
        <div className="flex-1">
          <span className="inline-block text-[10px] uppercase tracking-widest text-electric border border-electric/30 rounded-full px-3 py-1 mb-4">
            Gratuit · sans inscription
          </span>
          <h2 className="text-4xl font-black mb-4 leading-tight">
            REJOINS NOTRE<br />
            <span className="text-electric">COMMUNAUTÉ GRATUITE</span>
          </h2>
          <p className="text-gray-400 mb-5">
            Pronostics gratuits de base chaque jour et analyses de matchs. Accès libre, sans rien
            faire.
          </p>
          <div className="glass rounded-xl p-3 mb-6 flex items-start gap-2 text-sm text-gray-300 border border-gold/20">
            <Lock size={16} className="text-gold mt-0.5 shrink-0" />
            <span>
              Les <b className="text-gold">coupons exclusifs, cadeaux et dépôts gratuits</b> ne sont
              <b> pas</b> ici : ils sont réservés à la communauté <b>privée</b>, débloquée via le{' '}
              <b className="text-gold">Pack Flash</b>.
            </span>
          </div>
          <CommunityCta />
          <div className="flex flex-wrap gap-4 mt-4">
            <a href="https://t.me/+gI80LAtr1zRlNmM0" target="_blank" rel="noopener noreferrer"
              className="flex items-center bg-[#229ED9] px-6 rounded-xl font-bold hover:brightness-110 transition tap-target">
              <Send className="mr-3" /> Telegram
            </a>
            <a href="https://chat.whatsapp.com/IbNKAjNHPoaGgHjRJkq7Xr" target="_blank" rel="noopener noreferrer"
              className="flex items-center bg-[#25D366] px-6 rounded-xl font-bold hover:brightness-110 transition tap-target">
              <MessageCircle className="mr-3" /> WhatsApp
            </a>
          </div>
          <CommunityCta />
        </div>
        <div className="flex-1">
          <div className="w-64 h-96 bg-black rounded-[3rem] border-4 border-slate-700 relative mx-auto shadow-2xl overflow-hidden">
            <div className="bg-electric h-10 w-full flex items-center px-4 text-[10px] font-bold">
              JOVKEY PREDICTIONS
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-slate-800 p-2 rounded-lg text-[10px] w-4/5">
                Nouveau coupon gratuit disponible ! 🚀
              </div>
              <div className="bg-blue-900/50 p-2 rounded-lg text-[10px] w-4/5 ml-auto">
                Merci Jovkey ! C&apos;est passé ✅
              </div>
              <div className="bg-slate-800 p-2 rounded-lg">
                <div className="w-full h-20 bg-slate-700 rounded-md mb-2 flex items-center justify-center text-xs">
                  COUPON COTE 5.40
                </div>
                <div className="text-[8px] text-gray-400">Utilise le code JOVKEY pour doubler tes gains.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
