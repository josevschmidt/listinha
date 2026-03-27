"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationSetup } from "@/components/NotificationSetup";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ServiceWorkerRegistration />
      <NotificationSetup />
      {children}
    </AuthProvider>
  );
}
