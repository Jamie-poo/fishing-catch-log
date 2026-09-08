export type HomeMapControlOption = {
  key: string
  label: string
}

export const homeMapControlOptions: HomeMapControlOption[] = [
  { key: "weather", label: "Weather button" },
  { key: "intel", label: "Intel button" },
  { key: "fieldNote", label: "Field Note / Pin button" },
  { key: "recenter", label: "Recenter button" },
  { key: "measure", label: "Measure button" },
  { key: "layers", label: "Layers button" },
]

export function defaultHomeMapControls() {
  return Object.fromEntries(
    homeMapControlOptions.map((option) => [option.key, true])
  )
}
