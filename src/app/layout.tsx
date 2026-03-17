import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Listinha - Lista de Compras Inteligente",
  description: "Rastreador de preços histórico e scanner de nota fiscal com IA.",
  manifest: "/manifest.json",
  themeColor: "#2563eb",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Listinha",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} font-sans antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
