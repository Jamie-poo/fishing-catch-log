export type HomeMapDisplayOption = {
  key: string
  label: string
}

export const homeMapDisplayOptions: HomeMapDisplayOption[] = [
  { key: "catchPins", label: "Logged catch pins" },
  { key: "markerNameLabels", label: "Marker name labels" },
  { key: "searchSelectionMarker", label: "Selected search marker" },
]

export function defaultHomeMapDisplay() {
  return Object.fromEntries(
    homeMapDisplayOptions.map((option) => [option.key, true])
  )
}
