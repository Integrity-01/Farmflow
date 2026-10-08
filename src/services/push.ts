import { api } from '@/services/api';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function supported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

export const pushApi = {
  async getPublicKey(): Promise<string | null> {
    const result = await api.get<{ data: { publicKey: string | null } }>('/push/vapid-public-key');
    return result.data.publicKey;
  },

  async subscribe(subscription: PushSubscription): Promise<void> {
    await api.post('/push/subscribe', {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(subscription.getKey('p256dh') as ArrayBuffer),
        auth: arrayBufferToBase64(subscription.getKey('auth') as ArrayBuffer),
      },
    });
  },

  async unsubscribe(endpoint: string): Promise<void> {
    await api.post('/push/unsubscribe', { endpoint });
  },
};

export async function pushPermissionStatus(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
  if (!supported()) return 'unsupported';
  return Notification.permission;
}

export async function subscribeDevicePush(): Promise<boolean> {
  if (!supported()) return false;
  if (Notification.permission === 'denied') return false;

  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const publicKey = await pushApi.getPublicKey();
    if (!publicKey) return false;

    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await pushApi.subscribe(existing);
      return true;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    await pushApi.subscribe(subscription);
    return true;
  } catch {
    return false;
  }
}

export async function unsubscribeDevicePush(): Promise<boolean> {
  if (!supported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const { endpoint } = subscription;
      await subscription.unsubscribe().catch(() => undefined);
      await pushApi.unsubscribe(endpoint).catch(() => undefined);
    }
    return true;
  } catch {
    return false;
  }
}