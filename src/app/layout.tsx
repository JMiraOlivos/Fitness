import type { Metadata, Viewport } from "next";
import { AppNavigation } from "@/components/AppNavigation";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SessionProvider } from "@/components/SessionProvider";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { InstallPrompt } from "@/components/InstallPrompt";
import { SyncInitializer } from "@/components/SyncInitializer";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "NextGen Fitness App",
  description: "Monitoreo inteligente de entrenamientos con IA",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fitness",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-black antialiased">
        <ServiceWorkerRegistration />
        <SyncInitializer />
        <SessionProvider>
          <ErrorBoundary
            fallback={
              <main className="min-h-screen bg-black text-white p-6 pb-28 font-sans max-w-md mx-auto flex flex-col items-center justify-center text-center">
                <AlertTriangle className="h-10 w-10 text-amber-400 mb-4" />
                <h1 className="text-xl font-black">Algo salió mal</h1>
                <p className="text-sm text-zinc-400 mt-2">Ocurrió un error inesperado.</p>
                <Link href="/" className="mt-5 inline-flex items-center justify-center rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black">
                  Volver al inicio
                </Link>
              </main>
            }
          >
            {children}
          </ErrorBoundary>
          <InstallPrompt />
          <AppNavigation />
        </SessionProvider>
      </body>
    </html>
  );
}
