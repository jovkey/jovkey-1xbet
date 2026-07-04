'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, track } from '@/lib/api';
import { useRealtime } from '@/lib/useRealtime';
import { PublicCmsConfig, Prediction } from '@/lib/types';
import Carousel from './Carousel';
import TutorialVideo from './TutorialVideo';
import FreeCoupon from './FreeCoupon';
import FlashFunnelModal from './FlashFunnelModal';

export default function VitrineDynamic() {
  const [cms, setCms] = useState<PublicCmsConfig>({ slides: [], marquee: [], settings: {} });
  const [free, setFree] = useState<Prediction | null>(null);

  const refresh = useCallback(() => {
    api<PublicCmsConfig>('/cms/public').then(setCms).catch(() => {});
    api<Prediction | null>('/predictions/free-of-the-day').then(setFree).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    track('page_view', '/');
  }, [refresh]);

  // Rafraîchissement instantané quand l'admin modifie le CMS ou que l'IA pousse une cote.
  useRealtime((type) => {
    if (type === 'cms.updated' || type === 'prediction.new' || type === 'message') refresh();
  });

  return (
    <>
      <Carousel slides={cms.slides} />
      <TutorialVideo video={cms.settings?.tutorial_video} />
      <FreeCoupon prediction={free} video={cms.settings?.tutorial_video} settings={cms.settings} />
      <FlashFunnelModal video={cms.settings?.tutorial_video} />
    </>
  );
}
