export type HomeSearchOption = {
  key: string
  label: string
}

export const homeSearchOptions: HomeSearchOption[] = [
  { key: "notes", label: "Field Notes / Pins" },
  { key: "catches", label: "Logged catches" },
  { key: "places", label: "Places and roads" },
]

export function defaultHomeSearch() {
  return Object.fromEntries(
    homeSearchOptions.map((option) => [option.key, true])
  )
}
