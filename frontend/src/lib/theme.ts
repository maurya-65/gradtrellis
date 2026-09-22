// Appearance is a per-device choice, kept in localStorage. index.html applies it before
// the first paint; this keeps it in sync afterwards.
export type Theme = "light" | "dark" | "system";

const KEY = "theme";
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

export function getTheme(): Theme {
  const saved = localStorage.getItem(KEY);
  return saved === "light" || saved === "dark" ? saved : "system";
}

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && systemDark.matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function setTheme(theme: Theme) {
  if (theme === "system") localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, theme);
  apply(theme);
}

// "system" follows the OS switching between light and dark while the page is open
export function watchSystemTheme() {
  systemDark.addEventListener("change", () => apply(getTheme()));
}
