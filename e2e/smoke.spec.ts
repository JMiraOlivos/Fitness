import { test, expect } from "@playwright/test";

// Smoke tests that verify every page renders without crashes in unauthenticated
// state. Full authenticated flows need a real Supabase instance (not available
// in CI yet — see ROADMAP.md vNext 11). These tests catch regressions that would
// break the client-side rendering pipeline.

test.describe("Smoke: pages render without crash", () => {
  test("Dashboard (/) loads unauthenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Hola, Guerrero")).toBeVisible();
    await expect(page.getByText("Tu entrenamiento, progreso e IA en un solo lugar.")).toBeVisible();
    // "Entrenar" appears in both the CTA button and the bottom nav — check the main one
    await expect(page.getByRole("main").getByRole("link", { name: "Entrenar" })).toBeVisible();
    await expect(page.getByText("Crea tu usuario")).toBeVisible();
  });

  test("Auth page (/auth) loads with login form", async ({ page }) => {
    await page.goto("/auth");
    // Default mode is signup, heading is "Crear usuario"
    await expect(page.getByRole("heading", { name: "Crear usuario" })).toBeVisible();
    // Email input should be present
    await expect(page.getByPlaceholder("tu@email.com")).toBeVisible();
    await expect(page.getByPlaceholder("Mínimo 6 caracteres")).toBeVisible();
  });

  test("Entrenar page (/entrenar) loads", async ({ page }) => {
    await page.goto("/entrenar");
    await expect(page.getByText("Inicia sesión primero")).toBeVisible();
    // "Entrenar" appears in both the main heading and bottom nav
    await expect(page.getByRole("main").getByText("Entrenar", { exact: true })).toBeVisible();
  });

  test("Historial page (/historial) loads", async ({ page }) => {
    await page.goto("/historial");
    // Page renders without crashing — check for navigation or heading text
    await expect(page.locator("nav")).toBeVisible();
  });

  test("Progreso page (/progreso) loads", async ({ page }) => {
    await page.goto("/progreso");
    await expect(page.getByText("Inicia sesión primero")).toBeVisible();
    await expect(page.getByText("Peso corporal")).toBeVisible();
  });

  test("Perfil page (/perfil) loads", async ({ page }) => {
    await page.goto("/perfil");
    await expect(page.getByText("Inicia sesión primero")).toBeVisible();
    await expect(page.getByText("Perfil", { exact: true })).toBeVisible();
  });

  test("Onboarding page (/onboarding) unauthenticated redirects to login", async ({ page }) => {
    await page.goto("/onboarding");
    // Unauthenticated state shows login prompt
    await expect(page.getByText("Inicia sesión primero")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir a login" })).toBeVisible();
  });

  test("Programs page (/programas) loads", async ({ page }) => {
    await page.goto("/programas");
    await expect(page.getByText("Inicia sesión primero")).toBeVisible();
    await expect(page.getByText("Programas")).toBeVisible();
  });
});

test.describe("Navigation", () => {
  test("Bottom nav links navigate correctly", async ({ page }) => {
    await page.goto("/");

    // Click Entrenar in bottom nav
    await page.locator("nav").getByRole("link", { name: "Entrenar" }).click();
    await expect(page).toHaveURL("/entrenar");

    // Click Historial
    await page.locator("nav").getByRole("link", { name: "Historial" }).click();
    await expect(page).toHaveURL("/historial");

    // Click Progreso
    await page.locator("nav").getByRole("link", { name: "Progreso" }).click();
    await expect(page).toHaveURL("/progreso");

    // Click Inicio
    await page.locator("nav").getByRole("link", { name: "Inicio" }).click();
    await expect(page).toHaveURL("/");
  });
});

test.describe("Coach IA proactivo (vNext+ P0-1)", () => {
  test("Dashboard unauthenticated shows account prompt, not coach card", async ({ page }) => {
    await page.goto("/");
    // Unauthenticated: AccountCard shows "Crea tu usuario"
    await expect(page.getByText("Crea tu usuario")).toBeVisible();
    // Coach card section should not render (no recommendations to show)
    await expect(page.getByText("Recomendaciones del coach")).not.toBeVisible();
  });

  test("Dashboard renders CoachGenerator for anonymous users", async ({ page }) => {
    await page.goto("/");
    // CoachGenerator is always visible — anonymous users can generate routines
    await expect(page.getByText("Coach IA")).toBeVisible();
  });
});
