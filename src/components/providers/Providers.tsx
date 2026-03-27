"use client";

import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationSetup } from "@/components/NotificationSetup";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NotificationSetup />
      {children}
    </AuthProvider>
  );
}
