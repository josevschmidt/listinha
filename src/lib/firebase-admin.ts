import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getMessaging, Messaging } from "firebase-admin/messaging";

let app: App;
let messaging: Messaging;

function getAdminApp() {
  if (!app) {
    if (getApps().length === 0) {
      app = initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
    } else {
      app = getApps()[0];
    }
  }
  return app;
}

export function getAdminMessaging(): Messaging {
  if (!messaging) {
    messaging = getMessaging(getAdminApp());
  }
  return messaging;
}
