import { useState, useEffect, useCallback, useRef } from 'react';

const BILLING = typeof window !== 'undefined' ? window.DayGlanceBilling : null;

function readStatus() {
  if (!BILLING) return { active: false, productId: null };
  try {
    return JSON.parse(BILLING.getStatus());
  } catch {
    return { active: false, productId: null };
  }
}

/**
 * Exposes Google Play subscription state to the React app.
 *
 * Only available inside the Android WebView — `isAndroidApp` is false on web/Electron.
 *
 * Usage:
 *   const { isPro, isAndroidApp, subscribe, refresh } = useSubscription();
 *
 *   if (isAndroidApp && !isPro) {
 *     return <PaywallPrompt onSubscribe={() => subscribe('dayglance_pro_monthly')} />;
 *   }
 */
export function useSubscription() {
  const [status, setStatus] = useState(readStatus);
  const pollRef = useRef(null);

  const refresh = useCallback(() => {
    if (!BILLING) return;
    BILLING.refresh?.();
    // Give Play ~2 s to update the cache, then re-read.
    setTimeout(() => setStatus(readStatus()), 2000);
  }, []);

  // Re-read when the user comes back from the Play purchase sheet.
  useEffect(() => {
    if (!BILLING) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  /**
   * Opens the Google Play subscription sheet.
   * productId: 'dayglance_pro_monthly' | 'dayglance_pro_annual'
   *
   * After the user completes or cancels, they return to the app and
   * visibilitychange fires — which calls refresh() automatically.
   * The polling here is a belt-and-suspenders fallback.
   */
  const subscribe = useCallback((productId = 'dayglance_pro_monthly') => {
    if (!BILLING) return;
    BILLING.purchase?.(productId);

    // Poll every 3 s for up to 5 min in case visibilitychange doesn't fire.
    if (pollRef.current) clearInterval(pollRef.current);
    const deadline = Date.now() + 5 * 60 * 1000;
    pollRef.current = setInterval(() => {
      const s = readStatus();
      if (s.active) {
        setStatus(s);
        clearInterval(pollRef.current);
        pollRef.current = null;
      } else if (Date.now() > deadline) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 3000);
  }, []);

  // Clean up polling on unmount.
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  return {
    isPro: status.active,
    productId: status.productId,
    isAndroidApp: !!BILLING,
    subscribe,
    refresh,
  };
}
