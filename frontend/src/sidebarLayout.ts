import type { AppContext } from "./appState.ts";
import { loadSidebarVisible, saveSidebarVisible } from "./state.ts";

const MOBILE_LAYOUT = window.matchMedia("(max-width: 640px)");

function syncLayoutVars(): void {
  const header = document.querySelector<HTMLElement>("#header");
  if (!header) return;
  document.documentElement.style.setProperty("--header-height", `${header.offsetHeight}px`);
}

function isSidebarVisible(): boolean {
  const sidebar = document.querySelector("#sidebar");
  return sidebar !== null && !sidebar.classList.contains("hidden");
}

function updateSidebarBackdrop(visible: boolean): void {
  const backdrop = document.querySelector<HTMLButtonElement>("#sidebar-backdrop");
  if (!backdrop) return;
  backdrop.hidden = !visible || !MOBILE_LAYOUT.matches;
}

function updateSidebarShowButton(sidebarVisible: boolean): void {
  const showBtn = document.querySelector<HTMLButtonElement>("#sidebar-show-btn");
  if (!showBtn) return;

  if (MOBILE_LAYOUT.matches) {
    showBtn.classList.add("visible");
    showBtn.textContent = sidebarVisible ? "Items «" : "Items »";
    const label = sidebarVisible ? "Hide sidebar" : "Show sidebar";
    showBtn.title = label;
    showBtn.setAttribute("aria-label", label);
    return;
  }

  showBtn.classList.toggle("visible", !sidebarVisible);
  showBtn.textContent = "Items »";
  showBtn.title = "Show sidebar";
  showBtn.setAttribute("aria-label", "Show sidebar");
}

export function setSidebarVisible(ctx: AppContext, visible: boolean): void {
  const sidebar = document.querySelector("#sidebar");
  if (!sidebar) return;
  sidebar.classList.toggle("hidden", !visible);
  syncLayoutVars();
  updateSidebarBackdrop(visible);
  updateSidebarShowButton(visible);
  saveSidebarVisible(visible);
  ctx.mapHandles?.map.invalidateSize();
}

export function bindSidebarControls(ctx: AppContext): void {
  document
    .querySelector("#sidebar-hide-btn")
    ?.addEventListener("click", () => setSidebarVisible(ctx, false));
  document.querySelector("#sidebar-show-btn")?.addEventListener("click", () => {
    setSidebarVisible(ctx, !isSidebarVisible());
  });
  document
    .querySelector("#sidebar-backdrop")
    ?.addEventListener("click", () => setSidebarVisible(ctx, false));
  MOBILE_LAYOUT.addEventListener("change", () => {
    syncLayoutVars();
    updateSidebarBackdrop(isSidebarVisible());
    updateSidebarShowButton(isSidebarVisible());
  });
  window.addEventListener("resize", syncLayoutVars);
}

export function restoreSidebarVisibility(ctx: AppContext): void {
  setSidebarVisible(ctx, loadSidebarVisible());
}
