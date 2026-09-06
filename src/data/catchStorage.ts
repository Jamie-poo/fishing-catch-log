import type { CatchRecord } from "./catchData"

const LEGACY_CATCHES_KEY = "catches"
const DB_NAME = "fishing-catch-log"
const STORE_NAME = "app-data"
const CATCHES_KEY = "catches"

function toNumberOrNull(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return null
  }

  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function normalizeCatches(value: unknown): CatchRecord[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((fish) => {
    const catchRecord = fish as CatchRecord

    return {
      ...catchRecord,
      length: toNumberOrNull(catchRecord.length),
      weight: toNumberOrNull(catchRecord.weight),
    }
  })
}

export function loadLegacyCatchesSync() {
  const savedCatches = localStorage.getItem(LEGACY_CATCHES_KEY)

  if (!savedCatches) {
    return []
  }

  try {
    return normalizeCatches(JSON.parse(savedCatches))
  } catch {
    return []
  }
}

function openCatchDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available"))
      return
    }

    const request = indexedDB.open(DB_NAME, 1)

    request.addEventListener("upgradeneeded", () => {
      request.result.createObjectStore(STORE_NAME)
    })

    request.addEventListener("success", () => resolve(request.result))
    request.addEventListener("error", () => reject(request.error))
  })
}

function readCatchesFromIndexedDb() {
  return new Promise<CatchRecord[] | null>((resolve, reject) => {
    openCatchDatabase()
      .then((database) => {
        const transaction = database.transaction(STORE_NAME, "readonly")
        const store = transaction.objectStore(STORE_NAME)
        const request = store.get(CATCHES_KEY)

        request.addEventListener("success", () => {
          resolve(request.result === undefined ? null : normalizeCatches(request.result))
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

function saveCatchesToIndexedDb(catches: CatchRecord[]) {
  return new Promise<void>((resolve, reject) => {
    openCatchDatabase()
      .then((database) => {
        const transaction = database.transaction(STORE_NAME, "readwrite")
        const store = transaction.objectStore(STORE_NAME)

        store.put(catches, CATCHES_KEY)
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

export async function loadCatchRecords() {
  const indexedCatches = await readCatchesFromIndexedDb().catch(() => null)

  if (indexedCatches !== null) {
    return indexedCatches
  }

  const legacyCatches = loadLegacyCatchesSync()

  if (legacyCatches.length > 0) {
    await saveCatchesToIndexedDb(legacyCatches).catch(() => undefined)
  }

  return legacyCatches
}

export async function saveCatchRecords(catches: CatchRecord[]) {
  try {
    await saveCatchesToIndexedDb(catches)
    return
  } catch {
    localStorage.setItem(LEGACY_CATCHES_KEY, JSON.stringify(catches))
  }
}
