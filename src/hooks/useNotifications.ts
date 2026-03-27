"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { requestNotificationPermission, onForegroundMessage } from "@/lib/firebase-messaging";

export function useNotifications() {
  const { user } = useAuth();
  const initialized = useRef(false);

  useEffect(() => {
    if (!user || initialized.current) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    initialized.current = true;

    async function registerToken() {
      // Wait for the next-pwa service worker to be ready
      let registration: ServiceWorkerRegistration | undefined;
      try {
        registration = await navigator.serviceWorker.ready;
      } catch (err) {
        console.error("SW not available:", err);
        return;
      }

      const token = await requestNotificationPermission(registration);
      if (!token || !user) return;

      // Store token in Firestore
      await setDoc(doc(db, "fcm_tokens", token), {
        userId: user.uid,
        token,
        createdAt: serverTimestamp(),
      });
    }

    registerToken();

    // Handle foreground notifications with a toast-like approach
    const unsubscribe = onForegroundMessage((payload) => {
      if (Notification.permission === "granted" && payload.title) {
        new Notification(payload.title, {
          body: payload.body,
          icon: "/icons/icon-192x192.png",
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user]);
}
