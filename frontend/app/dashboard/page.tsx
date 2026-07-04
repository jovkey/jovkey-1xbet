'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { api, logout as apiLogout } from '@/lib/api';
import { AuthUser } from '@/lib/types';
import GoldDashboard from '@/components/dashboard/GoldDashboard';
import InvestorDashboard from '@/components/dashboard/InvestorDashboard';
import AdminPanel from '@/components/dashboard/AdminPanel';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    // Le cookie httpOnly (s'il existe) est envoyé automatiquement : on tente directement
    // /auth/me plutôt que de vérifier un token côté client (illisible depuis du JS, exprès).
    api<AuthUser>('/auth/me', { auth: true })
      .then(setUser)
      .catch(() => router.replace('/login'));
  }, [router]);

  const logout = () => {
    apiLogout().finally(() => router.replace('/login'));
  };

  if (!user) return <main className="min-h-screen flex items-center justify-center text-gray-500">Chargement…</main>;

  // Routage automatique par rôle : aucune URL secrète, on arrive au bon espace.
  if (user.role === 'admin' || user.role === 'superadmin') {
    return <AdminPanel user={user} onLogout={logout} />;
  }

  return (
    <main className="min-h-screen px-4 md:px-8 py-6 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <Link href="/" className="text-xl font-black text-gold italic">JOVKEY-1XBET</Link>
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-widest text-gray-400">
            {user.role} · {user.email}
          </span>
          <button onClick={logout} className="glass rounded-full p-2 hover:bg-white/10" aria-label="Déconnexion">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {user.role === 'investor' ? <InvestorDashboard /> : <GoldDashboard />}
    </main>
  );
}
