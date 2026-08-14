export type ThemePreference = "system" | "light" | "dark"

export function getSavedTheme(): ThemePreference {
  const saved = localStorage.getItem("theme-preference")
  return saved === "light" || saved === "dark" || saved === "system"
    ? saved
    : "system"
}

export function applyThemePreference(theme: ThemePreference) {
  localStorage.setItem("theme-preference", theme)

  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme")
    return
  }

  document.documentElement.dataset.theme = theme
}
