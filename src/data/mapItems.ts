export type MapLocationPoint = {
  latitude: number
  longitude: number
}

export type SavedMapItem = MapLocationPoint & {
  id: number
  type: "waypoint" | "field-note" | "field-note-waypoint"
  title: string
  note: string
  category?: string
  createdAt: string
  photoDataUrls?: string[]
  conditions?: { label: string; value: string }[]
}

const MAP_ITEMS_KEY = "catch-map-items"

export function loadMapItems() {
  const saved = localStorage.getItem(MAP_ITEMS_KEY)
  if (!saved) return []

  try {
    const parsed = JSON.parse(saved)
    return Array.isArray(parsed) ? (parsed as SavedMapItem[]) : []
  } catch {
    return []
  }
}

export function saveMapItems(items: SavedMapItem[]) {
  localStorage.setItem(MAP_ITEMS_KEY, JSON.stringify(items))
}

export function getMapItemTypeLabel(item: SavedMapItem) {
  if (item.type === "field-note-waypoint") return "Field Note / Pin"
  if (item.type === "field-note") return "Field Note / Pin"
  if (item.type === "waypoint" && item.category) return `${item.category} waypoint`
  if (item.type === "waypoint") return "Waypoint"

  return "Field Note / Pin"
}

export function isLegacyWaypointForFieldNote(
  item: SavedMapItem,
  items: SavedMapItem[]
) {
  if (
    item.type !== "waypoint" ||
    item.category !== "Field note" ||
    item.note !== "Created from field note"
  ) {
    return false
  }

  return items.some(
    (other) =>
      other.type === "field-note" &&
      other.title === item.title &&
      Math.abs(other.latitude - item.latitude) < 0.000001 &&
      Math.abs(other.longitude - item.longitude) < 0.000001
  )
}
