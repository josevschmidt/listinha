"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { onForegroundMessage } from "@/lib/firebase-messaging";

export function useNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

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
