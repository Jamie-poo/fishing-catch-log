export type HomeSummaryOption = {
  key: string
  label: string
}

export const homeSummaryOptions: HomeSummaryOption[] = [
  { key: "panel", label: "Home summary card" },
  { key: "location", label: "Location name" },
  { key: "gpsStatus", label: "GPS status" },
  { key: "search", label: "Map search" },
  { key: "time", label: "Current time" },
  { key: "logged", label: "Logged catches" },
  { key: "species", label: "Species count" },
  { key: "mapButton", label: "Catch map button" },
]

export function defaultHomeSummary() {
  return Object.fromEntries(homeSummaryOptions.map((option) => [option.key, true]))
}
