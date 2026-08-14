export const mapFilterOptions = [
  { key: "species", label: "Species" },
  { key: "location", label: "Location" },
  { key: "minLength", label: "Minimum length" },
  { key: "minWeight", label: "Minimum weight" },
] as const

export function defaultMapFilters() {
  return Object.fromEntries(
    mapFilterOptions.map((filter) => [filter.key, true])
  )
}
