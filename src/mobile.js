import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';

export function setMobileTheme(theme) {
  if (Capacitor.isNativePlatform()) {
    SystemBars.setStyle({ style: theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
  }
}

export async function answerHaptic(correct) {
  if (Capacitor.isNativePlatform()) {
    await Haptics.notification({ type: correct ? NotificationType.Success : NotificationType.Error }).catch(() => {});
  } else if (navigator.vibrate) {
    navigator.vibrate(correct ? [40, 60, 40] : [180]);
  }
}

export function connectMobile(onBack, onResume) {
  if (!Capacitor.isNativePlatform()) return () => {};
  let disposed = false;
  const listeners = [];
  const attach = async (event, handler) => {
    const listener = await NativeApp.addListener(event, handler);
    if (disposed) await listener.remove();
    else listeners.push(listener);
  };
  attach('backButton', () => {
    if (!document.dispatchEvent(new CustomEvent('taxi-native-back', { cancelable: true }))) return;
    if (!onBack()) NativeApp.minimizeApp();
  }).catch(console.error);
  attach('appStateChange', ({ isActive }) => { if (isActive) onResume(); }).catch(console.error);
  // Keep the launch screen until React has actually mounted.
  SplashScreen.hide().catch(() => {});
  return () => { disposed = true; listeners.forEach(listener => listener.remove()); };
}
