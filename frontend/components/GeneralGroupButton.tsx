'use client';
import { MessageCircle } from 'lucide-react';
import { useCommunityLinks } from '@/lib/useCommunityLinks';

/**
 * CTA « groupe général » de la hero section : ouvre DIRECTEMENT WhatsApp (pas de scroll
 * vers la section communauté). Lien piloté par le CMS (cms_settings.community_whatsapp_link)
 * pour pouvoir le changer sans redéploiement quand le lien d'invitation expire.
 */
export default function GeneralGroupButton() {
  const { whatsapp } = useCommunityLinks();
  return (
    <a
      href={whatsapp}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-electric text-black px-6 rounded-xl font-black text-sm md:text-base shadow-xl animate-pulseElectric tap-target flex items-center justify-center gap-2 text-center"
    >
      <MessageCircle size={18} /> REJOINDRE LE GROUPE
    </a>
  );
}
