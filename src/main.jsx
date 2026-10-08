import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/500.css'
import '@fontsource/outfit/600.css'
import '@fontsource/outfit/700.css'
import '@fontsource/outfit/800.css'
import '@fontsource/dm-mono/300.css'
import '@fontsource/dm-mono/400.css'
import '@fontsource/dm-mono/500.css'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { SplashScreen } from '@capacitor/splash-screen'
import { initializeNativeStorage } from './storage.js'

const root = createRoot(document.getElementById('root'));
let starting = false;
async function start() {
  if (starting) return;
  starting = true;
  try {
    if (Capacitor.isNativePlatform()) await initializeNativeStorage(Preferences);
    // Installation ID and progress must only load after native state is ready.
    const { default: App } = await import('./App.jsx');
    root.render(<StrictMode><App /></StrictMode>);
  } catch (error) {
    console.error('Could not open saved app data', String(error));
    await SplashScreen.hide().catch(() => {});
    root.render(<main style={{ padding: 'max(48px, env(safe-area-inset-top)) 24px', maxWidth: '480px', margin: 'auto', fontFamily: 'Outfit, sans-serif' }}>
      <h1>Taxi Teori</h1>
      <p>Det gick inte att läsa dina sparade uppgifter. Försök igen. Radera inte appen eller dess data.</p>
      <button onClick={start} style={{ padding: '14px 20px', fontSize: '16px' }}>Försök igen</button>
    </main>);
  } finally { starting = false; }
}
start();
