export type EnvironmentSnapshot = {
  capturedAt: string
  source: "open-meteo"
  latitude: number | null
  longitude: number | null
  values: Record<string, string>
}

export type CatchRecord = {
  id: number
  dateTime: string
  latitude: number | null
  longitude: number | null
  species: string
  length: number | null
  weight: number | null
  notes: string
  photoDataUrl?: string
  photoDataUrls?: string[]
  locationName?: string
  details?: Record<string, Record<string, string>>
  environmentSnapshot?: EnvironmentSnapshot
}
