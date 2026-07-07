"use client";

import { useEffect, useState, useCallback } from "react";
import { isSyncing, onSyncChange, processQueue } from "./syncManager";
import { countPendingOps } from "./db";

export function useConnectivity() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setPendingCount(await countPendingOps());
    setSyncing(isSyncing());
    setIsOnline(
      typeof navigator === "undefined" ? true : navigator.onLine
    );
  }, []);

  useEffect(() => {
    void refresh();

    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const unsubscribeSync = onSyncChange(() => {
      void countPendingOps().then((count: number) => setPendingCount(count));
      setSyncing(isSyncing());
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribeSync();
    };
  }, [refresh]);

  const triggerSync = useCallback(() => {
    void processQueue();
  }, []);

  return {
    isOnline,
    pendingCount,
    isSyncing: syncing,
    triggerSync,
  };
}
