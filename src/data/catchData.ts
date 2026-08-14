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
}
