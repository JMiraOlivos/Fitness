"use client";

import { CloudOff, RefreshCw, CheckCircle2, Loader2 } from "lucide-react";
import { useConnectivity } from "@/lib/offline/useConnectivity";

export function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing } = useConnectivity();

  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  let bg = "bg-amber-500/10";
  let border = "border-amber-500/30";
  let text = "text-amber-200";
  let Icon = CloudOff;
  let message = "";

  if (isSyncing) {
    bg = "bg-blue-500/10";
    border = "border-blue-500/30";
    text = "text-blue-200";
    Icon = Loader2;
    message = `Sincronizando ${pendingCount > 0 ? `${pendingCount} operaciones` : "datos"}...`;
  } else if (!isOnline) {
    message = pendingCount > 0
      ? `Sin conexión · ${pendingCount} ${pendingCount === 1 ? "operación pendiente" : "operaciones pendientes"}`
      : "Sin conexión · las series se guardan localmente";
  } else if (pendingCount > 0) {
    bg = "bg-lime-500/10";
    border = "border-lime-500/30";
    text = "text-lime-200";
    Icon = RefreshCw;
    message = `${pendingCount} ${pendingCount === 1 ? "operación pendiente" : "operaciones pendientes"} de sincronizar`;
  }

  const showDismiss = isOnline && pendingCount === 0;

  return (
    <div className={`${bg} ${border} ${text} mx-auto max-w-md rounded-b-2xl border-t-0 border p-3 text-xs`}>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${isSyncing ? "animate-spin" : ""}`} />
        <p className="flex-1 font-medium">{message}</p>
        {showDismiss && (
          <CheckCircle2 className="h-4 w-4 shrink-0" />
        )}
      </div>
    </div>
  );
}
