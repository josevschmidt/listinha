import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";
import { app } from "@/lib/firebase";

let messagingInstance: Messaging | null = null;

function getMessagingInstance(): Messaging | null {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window)) return null;
  if (!messagingInstance) {
    messagingInstance = getMessaging(app);
  }
  return messagingInstance;
}

export async function requestNotificationPermission(
  serviceWorkerRegistration?: ServiceWorkerRegistration
): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const messaging = getMessagingInstance();
    if (!messaging) return null;

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.error("NEXT_PUBLIC_FIREBASE_VAPID_KEY not configured");
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration,
    });

    return token;
  } catch (error) {
    console.error("Error getting notification token:", error);
    return null;
  }
}

export function onForegroundMessage(callback: (payload: { title?: string; body?: string }) => void) {
  const messaging = getMessagingInstance();
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    callback({
      title: payload.notification?.title,
      body: payload.notification?.body,
    });
  });
}
