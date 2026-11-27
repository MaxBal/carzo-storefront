'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { MetaPublicConfig } from '@/lib/meta/types';
import { isMetaTrackingEnabled, type MetaMarketingPreference } from '@/lib/meta/preference';
import {
  browserCookie, captureMetaClick, configureMetaBrowser, CONSENT_COOKIE, revokeQueuedMetaEvents,
  CONSENT_ID_COOKIE, marketingHostAllowed, privacySignal, trackMetaPage, writeMarketingCookie,
} from '@/lib/meta/browser';

const TrackingContext = createContext(false);
export const useMetaTrackingReady = () => useContext(TrackingContext);

export default function MetaTrackingProvider({ config, children }: { config: MetaPublicConfig | null; children: React.ReactNode }) {
  const path = usePathname();
  const [choice, setChoice] = useState<MetaMarketingPreference | null>(null);
  const [available, setAvailable] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const lastPage = useRef('');

  useEffect(() => {
    if (!config || !marketingHostAllowed(config)) return;
    configureMetaBrowser(config);
    setAvailable(true);
    const stored = browserCookie(CONSENT_COOKIE);
    if (privacySignal()) {
      writeMarketingCookie(CONSENT_COOKIE, 'denied'); void revokeQueuedMetaEvents(); setChoice('denied');
    } else if (stored === 'denied') { setChoice('denied'); void revokeQueuedMetaEvents(); }
    else {
      // Store automatic enablement honestly; do not manufacture an explicit opt-in.
      const next = stored === 'granted' ? 'granted' : 'enabled';
      if (stored !== next) writeMarketingCookie(CONSENT_COOKIE, next);
      if (!browserCookie(CONSENT_ID_COOKIE)) writeMarketingCookie(CONSENT_ID_COOKIE, crypto.randomUUID());
      setChoice(next);
    }
    return () => configureMetaBrowser(null);
  }, [config]);

  useEffect(() => {
    if (!available || !isMetaTrackingEnabled(choice)) { lastPage.current = ''; return; }
    if (lastPage.current === path) return;
    lastPage.current = path;
    captureMetaClick(); trackMetaPage(path);
  }, [available, choice, path]);

  const choose = async (next: 'granted' | 'denied') => {
    if (next === 'granted' && privacySignal()) next = 'denied';
    const previous = browserCookie(CONSENT_COOKIE);
    writeMarketingCookie(CONSENT_COOKIE, next);
    if (next === 'granted') {
      if (previous !== 'granted' || !browserCookie(CONSENT_ID_COOKIE)) writeMarketingCookie(CONSENT_ID_COOKIE, crypto.randomUUID());
    } else void revokeQueuedMetaEvents();
    setChoice(next); setSettingsOpen(false);
  };

  return (
    <TrackingContext.Provider value={available && isMetaTrackingEnabled(choice)}>
      {children}
      {available && <div className="bg-black px-4 pb-4 text-center">
        <button type="button" className="text-xs text-gray-300 underline underline-offset-4" onClick={() => setSettingsOpen(true)}>Налаштування cookies</button>
      </div>}
      {available && settingsOpen && <section role="region" aria-label="Налаштування маркетингових cookies"
        className="fixed inset-x-3 bottom-3 z-[11000] mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-4 text-[#111111] shadow-xl sm:p-5">
        <p className="text-sm font-semibold">Маркетингові cookies</p>
        <p className="mt-2 text-sm leading-5 text-gray-600">Для вимірювання реклами використовуємо Meta Pixel та Conversions API. Тут можна вимкнути або знову ввімкнути передачу рекламних подій. <a href="/privacy-policy" className="underline underline-offset-2">Політика конфіденційності</a></p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="min-h-11 flex-1 rounded-xl border border-gray-300 px-4 text-sm font-medium" onClick={() => void choose('denied')}>Вимкнути</button>
          <button type="button" className="min-h-11 flex-1 rounded-xl bg-black px-4 text-sm font-medium text-white" onClick={() => void choose('granted')}>Увімкнути</button>
        </div>
      </section>}
    </TrackingContext.Provider>
  );
}
