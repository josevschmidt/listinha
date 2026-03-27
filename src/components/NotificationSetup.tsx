"use client";

import { useNotifications } from "@/hooks/useNotifications";

export function NotificationSetup() {
  useNotifications();
  return null;
}
