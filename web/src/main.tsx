import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { env } from './lib/env';
import './index.css';

async function enableMocking() {
  // VITE_API_MOCK=true: answer API calls in the browser with MSW (src/mocks).
  if (!env.apiMock) return;
  try {
    const { startMocking } = await import('./mocks/browser');
    const how = await startMocking();
    console.info('[mock] MSW enabled (%s) — API calls to %s are mocked', how, env.apiBaseUrl);
  } catch (err) {
    // Still render the app; API calls will go to the real backend and show errors.
    console.error('[mock] Could not start API mocking', err);
  }
}

void enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
