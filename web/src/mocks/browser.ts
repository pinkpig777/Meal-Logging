import { FetchInterceptor } from '@mswjs/interceptors/fetch';
import { setupWorker } from 'msw/browser';
import { defineNetwork, InterceptorSource } from 'msw/experimental';
import { handlers } from './handlers';

/**
 * Start API mocking in the browser.
 *
 * Normally uses the Service Worker (public/mockServiceWorker.js). Some
 * environments refuse to register service workers (Firefox private windows,
 * some embedded webviews); then we fall back to patching `fetch` in-page,
 * which is enough because the app only uses fetch.
 */
export async function startMocking(): Promise<'service-worker' | 'in-page'> {
  try {
    await setupWorker(...handlers).start({ onUnhandledFrame: 'bypass' });
    return 'service-worker';
  } catch (err) {
    console.warn('[mock] Service worker unavailable, falling back to in-page fetch mocking.', err);
    const network = defineNetwork({
      sources: [new InterceptorSource({ interceptors: [new FetchInterceptor()] })],
      handlers,
      onUnhandledFrame: 'bypass',
    });
    await network.enable();
    return 'in-page';
  }
}
