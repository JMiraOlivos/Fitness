"use client";

import { TrendingUp } from "lucide-react";
import { useDashboard } from "@/features/dashboard/hooks/useDashboard";
import { AccountCard } from "@/features/dashboard/components/AccountCard";
import { OnboardingBanner } from "@/features/dashboard/components/OnboardingBanner";
import { ActiveProgramCard } from "@/features/dashboard/components/ActiveProgramCard";
import { WeeklyMetrics } from "@/features/dashboard/components/WeeklyMetrics";
import { QuickActions } from "@/features/dashboard/components/QuickActions";
import { CoachGenerator } from "@/features/dashboard/components/CoachGenerator";
import { SavedRoutines } from "@/features/dashboard/components/SavedRoutines";

export default function Dashboard() {
  const dashboard = useDashboard();

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-28 font-sans max-w-md mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Hola, Guerrero</h1>
          <p className="text-zinc-400">Tu entrenamiento, progreso e IA en un solo lugar.</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
          <TrendingUp className="text-[#CCFF00] w-6 h-6" />
        </div>
      </header>

      <AccountCard user={dashboard.user} onSignOut={() => void dashboard.cerrarSesion()} />

      {dashboard.user && !dashboard.hasProfile && <OnboardingBanner />}

      {dashboard.activeProgram && <ActiveProgramCard program={dashboard.activeProgram} />}

      <WeeklyMetrics metrics={dashboard.metrics} isLoading={dashboard.isLoadingMetrics} />

      <QuickActions />

      <CoachGenerator
        diasDisponibles={dashboard.diasDisponibles}
        onDiasDisponiblesChange={dashboard.setDiasDisponibles}
        enfoque={dashboard.enfoque}
        onEnfoqueChange={dashboard.setEnfoque}
        restricciones={dashboard.restricciones}
        onRestriccionesChange={dashboard.setRestricciones}
        isGenerating={dashboard.isGenerating}
        onGenerate={() => void dashboard.generarRutina()}
        error={dashboard.error}
        successMessage={dashboard.successMessage}
        rutinasIA={dashboard.rutinasIA}
        isSaving={dashboard.isSaving}
        canSave={Boolean(dashboard.user)}
        onSave={(rutina) => void dashboard.guardarRutina(rutina)}
      />

      <SavedRoutines
        hasUser={Boolean(dashboard.user)}
        rutinas={dashboard.rutinasGuardadas}
        isLoading={dashboard.isLoadingSaved}
        onRefresh={() => void dashboard.cargarRutinasGuardadas()}
        confirmingDeleteId={dashboard.confirmingDeleteId}
        onToggleConfirmDelete={dashboard.setConfirmingDeleteId}
        isDeleting={dashboard.isDeleting}
        onDelete={(rutina) => void dashboard.borrarRutina(rutina)}
      />
    </main>
  );
}
