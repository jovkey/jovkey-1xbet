'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { useRealtime } from './useRealtime';

/**
 * Liens des groupes gratuits, éditables par l'admin (cms_settings) sans redéploiement —
 * utile car les liens d'invitation WhatsApp/Telegram expirent de temps en temps.
 * Ces valeurs par défaut servent tant que l'admin n'a rien enregistré.
 */
const DEFAULT_WHATSAPP = 'https://chat.whatsapp.com/Cwj5GyagLh7HGKM14d2HWn';
const DEFAULT_TELEGRAM = 'https://t.me/+gI80LAtr1zRlNmM0';

export function useCommunityLinks() {
  const [links, setLinks] = useState({ whatsapp: DEFAULT_WHATSAPP, telegram: DEFAULT_TELEGRAM });

  const refresh = useCallback(() => {
    api('/cms/public')
      .then((c: any) => {
        setLinks({
          whatsapp: c.settings?.community_whatsapp_link?.url || DEFAULT_WHATSAPP,
          telegram: c.settings?.community_telegram_link?.url || DEFAULT_TELEGRAM,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useRealtime((type) => {
    if (type === 'cms.updated') refresh();
  });

  return links;
}
