/**
 * Registers the offline shell (public/sw.js).
 *
 * Production only: a service worker in front of the Vite dev server serves
 * stale modules and breaks HMR in ways that look like phantom bugs.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  const base = import.meta.env.BASE_URL;
  // After load, so registration never competes with the first paint.
  window.addEventListener(
    'load',
    () => {
      void navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((error: unknown) => {
        console.warn('Service worker registration failed; the app still works online.', error);
      });
    },
    { once: true },
  );
}
