const TOAST_DURATION_MS = 2800;

let timer: number | undefined;

export function showToast(msg: string): void {
  const el = document.querySelector("#map-toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(timer);
  timer = window.setTimeout(() => el.classList.remove("show"), TOAST_DURATION_MS);
}
