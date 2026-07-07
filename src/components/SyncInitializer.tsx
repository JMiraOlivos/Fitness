"use client";

import { useEffect } from "react";
import { initSyncManager } from "@/lib/offline/syncManager";

export function SyncInitializer() {
  useEffect(() => {
    return initSyncManager();
  }, []);

  return null;
}
