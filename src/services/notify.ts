/**
 * Telefon / masaüstü bildirimleri.
 * Android Chrome'da sayfadan doğrudan `new Notification()` çalışmaz; bildirim service worker
 * üzerinden gösterilir. iPhone'da bildirim yalnızca ana ekrana eklenmiş uygulamada (iOS 16.4+) çalışır.
 */

export type NotifyStatus = NotificationPermission | 'unsupported';

export function notifyStatus(): NotifyStatus {
  return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
}

export async function requestNotifyPermission(): Promise<NotifyStatus> {
  if (notifyStatus() === 'unsupported') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function sendNotification(title: string, body: string, tag = 'para-defteri'): Promise<boolean> {
  if (notifyStatus() !== 'granted') return false;
  const options: NotificationOptions & { renotify?: boolean } = {
    body,
    tag,
    renotify: true,
    icon: './icon-192.png',
    badge: './icon-192.png',
    lang: 'tr',
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, options);
      return true;
    }
  } catch {
    /* aşağıdaki yönteme düş */
  }
  try {
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}
