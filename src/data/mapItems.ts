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
const DB_NAME = "fishing-catch-log"
const STORE_NAME = "app-data"

function normalizeMapItems(value: unknown) {
  return Array.isArray(value) ? (value as SavedMapItem[]) : []
}

export function loadMapItems() {
  const saved = localStorage.getItem(MAP_ITEMS_KEY)
  if (!saved) return []

  try {
    return normalizeMapItems(JSON.parse(saved))
  } catch {
    return []
  }
}

function openMapItemsDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available"))
      return
    }

    const request = indexedDB.open(DB_NAME, 1)

    request.addEventListener("upgradeneeded", () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
    })

    request.addEventListener("success", () => resolve(request.result))
    request.addEventListener("error", () => reject(request.error))
  })
}

function readMapItemsFromIndexedDb() {
  return new Promise<SavedMapItem[] | null>((resolve, reject) => {
    openMapItemsDatabase()
      .then((database) => {
        const transaction = database.transaction(STORE_NAME, "readonly")
        const store = transaction.objectStore(STORE_NAME)
        const request = store.get(MAP_ITEMS_KEY)

        request.addEventListener("success", () => {
          resolve(request.result === undefined ? null : normalizeMapItems(request.result))
        })
        request.addEventListener("error", () => reject(request.error))
        transaction.addEventListener("complete", () => database.close())
        transaction.addEventListener("abort", () => {
          database.close()
          reject(transaction.error)
        })
      })
      .catch(reject)
  })
}

function saveMapItemsToIndexedDb(items: SavedMapItem[]) {
  return new Promise<void>((resolve, reject) => {
    openMapItemsDatabase()
      .then((database) => {
        const transaction = database.transaction(STORE_NAME, "readwrite")
        const store = transaction.objectStore(STORE_NAME)

        store.put(items, MAP_ITEMS_KEY)
        transaction.addEventListener("complete", () => {
          database.close()
          resolve()
        })
        transaction.addEventListener("abort", () => {
          database.close()
          reject(transaction.error)
        })
        transaction.addEventListener("error", () => {
          database.close()
          reject(transaction.error)
        })
      })
      .catch(reject)
  })
}

export function mergeMapItems(
  storedItems: SavedMapItem[],
  currentItems: SavedMapItem[]
) {
  const byId = new Map<number, SavedMapItem>()

  storedItems.forEach((item) => byId.set(item.id, item))
  currentItems.forEach((item) => byId.set(item.id, item))

  return Array.from(byId.values()).sort(
    (first, second) =>
      new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
  )
}

export async function loadStoredMapItems() {
  const localItems = loadMapItems()
  const indexedItems = await readMapItemsFromIndexedDb().catch(() => null)

  if (indexedItems === null) {
    if (localItems.length > 0) {
      await saveMapItemsToIndexedDb(localItems).catch(() => undefined)
    }

    return localItems
  }

  const mergedItems = mergeMapItems(indexedItems, localItems)

  if (mergedItems.length !== indexedItems.length) {
    await saveStoredMapItems(mergedItems).catch(() => undefined)
  }

  return mergedItems
}

export async function saveStoredMapItems(items: SavedMapItem[]) {
  let indexedDbSaved = false

  try {
    await saveMapItemsToIndexedDb(items)
    indexedDbSaved = true
  } catch {
    // Keep trying the lightweight fallback below.
  }

  try {
    localStorage.setItem(MAP_ITEMS_KEY, JSON.stringify(items))
  } catch {
    if (!indexedDbSaved) {
      throw new Error("Map pins could not be saved")
    }
  }
}

export function saveMapItems(items: SavedMapItem[]) {
  try {
    localStorage.setItem(MAP_ITEMS_KEY, JSON.stringify(items))
  } catch {
    // IndexedDB handles larger note/photo payloads more reliably.
  }

  void saveMapItemsToIndexedDb(items).catch(() => undefined)
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
