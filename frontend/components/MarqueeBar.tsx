'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRealtime } from '@/lib/useRealtime';
import { MarqueeMessage } from '@/lib/types';
import Marquee from './Marquee';

/** Bandeau défilant placé juste sous le header (en haut de page). */
export default function MarqueeBar() {
  const [msgs, setMsgs] = useState<MarqueeMessage[]>([]);
  const load = () => api<any>('/cms/public').then((c) => setMsgs(c.marquee || [])).catch(() => {});
  useEffect(() => { load(); }, []);
  useRealtime((t) => { if (t === 'cms.updated' || t === 'message') load(); });

  if (!msgs.length) return null;
  // pt pour passer sous le header fixe.
  return (
    <div className="pt-[68px]">
      <Marquee messages={msgs} />
    </div>
  );
}
