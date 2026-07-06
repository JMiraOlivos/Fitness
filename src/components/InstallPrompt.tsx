"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

const DISMISSED_KEY = "fitness-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari exposes this instead of supporting the display-mode media query.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISSED_KEY) === "1") return;
    setDismissed(false);

    if (isIos()) {
      setShowIosInstructions(true);
      return;
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setDeferredPrompt(null);
      setDismissed(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDismissed(true);
    setDeferredPrompt(null);
  }

  if (dismissed || (!deferredPrompt && !showIosInstructions)) return null;

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/95 p-4 shadow-lg backdrop-blur-md">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#CCFF00]">
        {showIosInstructions ? <Share className="h-5 w-5 text-black" /> : <Download className="h-5 w-5 text-black" />}
      </div>
      <div className="flex-1 text-sm">
        <p className="font-bold text-white">Instala NextGen Fitness</p>
        <p className="text-xs text-zinc-400">
          {showIosInstructions
            ? "Toca el botón Compartir y luego 'Agregar a inicio'."
            : "Accede más rápido y úsala sin conexión."}
        </p>
      </div>
      {!showIosInstructions && (
        <button onClick={install} className="flex-shrink-0 rounded-xl bg-[#CCFF00] px-3 py-2 text-xs font-bold text-black">
          Instalar
        </button>
      )}
      <button onClick={dismiss} aria-label="Cerrar" className="flex-shrink-0 text-zinc-500">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
