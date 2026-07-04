export default function Footer() {
  return (
    <footer className="bg-black py-12 px-6 border-t border-white/5 text-center">
      <div className="text-2xl font-black text-gold italic mb-6">JOVKEY-1XBET</div>
      <p className="text-gray-500 text-xs max-w-xl mx-auto mb-8">
        Les paris sportifs comportent des risques : endettement, isolement, dépendance. Interdit
        aux mineurs.
      </p>
      <div className="flex justify-center space-x-6 text-gray-400 text-sm">
        <a href="#" className="hover:text-white">Mentions légales</a>
        <a href="#" className="hover:text-white">Support</a>
        <a href="#" className="hover:text-white">Confidentialité</a>
      </div>
      <div className="mt-8 text-gray-600 text-[10px] uppercase tracking-widest">
        © {new Date().getFullYear()} JOVKEY-1XBET — Tous droits réservés
      </div>
    </footer>
  );
}
