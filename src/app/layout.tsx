import type { Metadata, Viewport } from "next";
import { AppNavigation } from "@/components/AppNavigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "NextGen Fitness App",
  description: "Monitoreo inteligente de entrenamientos con IA",
  manifest: "/manifest.json",
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
        {children}
        <AppNavigation />
      </body>
    </html>
  );
}
