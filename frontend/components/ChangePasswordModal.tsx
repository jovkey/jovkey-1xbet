'use client';
import { useState } from 'react';
import { X, KeyRound } from 'lucide-react';
import { api } from '@/lib/api';
import { showToast } from '@/lib/clipboard';

export default function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) return setError('Nouveau mot de passe : 6 caractères minimum.');
    if (newPassword !== confirm) return setError('Les deux mots de passe ne correspondent pas.');
    setLoading(true);
    try {
      await api('/auth/change-password', { method: 'POST', auth: true, body: { currentPassword, newPassword } });
      showToast('Mot de passe mis à jour !');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Échec du changement de mot de passe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center px-4">
      <form onSubmit={submit} autoComplete="off" className="glass max-w-sm w-full p-6 rounded-3xl relative">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white" aria-label="Fermer">
          <X size={18} />
        </button>
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="text-gold" size={20} />
          <h2 className="text-lg font-black">Changer mon mot de passe</h2>
        </div>

        <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Mot de passe actuel</label>
        <input type="password" autoComplete="off" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full glass rounded-xl px-4 mb-3 tap-target outline-none focus:border-gold" placeholder="••••••••" />

        <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Nouveau mot de passe</label>
        <input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
          className="w-full glass rounded-xl px-4 mb-3 tap-target outline-none focus:border-gold" placeholder="••••••••" />

        <label className="block text-xs uppercase tracking-widest text-gray-400 mb-1">Confirmer le nouveau mot de passe</label>
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
          className="w-full glass rounded-xl px-4 mb-4 tap-target outline-none focus:border-gold" placeholder="••••••••" />

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button disabled={loading} className="w-full gold-gradient text-black rounded-xl font-black tap-target disabled:opacity-60">
          {loading ? 'Mise à jour…' : 'Mettre à jour'}
        </button>
      </form>
    </div>
  );
}
