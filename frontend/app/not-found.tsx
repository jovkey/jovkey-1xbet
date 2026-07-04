import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="text-7xl font-black text-gold italic mb-4">404</div>
      <p className="text-gray-400 mb-8">Cette page n&apos;existe pas.</p>
      <Link href="/" className="gold-gradient text-black px-8 py-3 rounded-xl font-black tap-target flex items-center">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
