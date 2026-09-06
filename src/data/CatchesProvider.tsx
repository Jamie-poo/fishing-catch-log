import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
} from "react"
import type { CatchRecord } from "./catchData"
import { CatchesContext } from "./catchesContext"
import { loadCatchRecords, loadLegacyCatchesSync, saveCatchRecords } from "./catchStorage"

export function CatchesProvider({ children }: { children: ReactNode }) {
  const [catches, setStoredCatches] = useState<CatchRecord[]>(loadLegacyCatchesSync)
  const [storageReady, setStorageReady] = useState(false)
  const hasUserChanges = useRef(false)

  const setCatches = useCallback((action: SetStateAction<CatchRecord[]>) => {
    hasUserChanges.current = true
    setStoredCatches(action)
  }, [])

  useEffect(() => {
    let isMounted = true

    loadCatchRecords()
      .then((savedCatches) => {
        if (!isMounted) {
          return
        }

        setStoredCatches((current) =>
          hasUserChanges.current ? current : savedCatches
        )
        setStorageReady(true)
      })
      .catch((error) => {
        console.warn("Catches could not be loaded from device storage.", error)

        if (isMounted) {
          setStorageReady(true)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!storageReady) {
      return
    }

    try {
      void saveCatchRecords(catches)
    } catch (error) {
      console.warn("Catches could not be saved locally.", error)
    }
  }, [catches, storageReady])

  const value = useMemo(() => ({ catches, setCatches }), [catches, setCatches])

  return (
    <CatchesContext.Provider value={value}>
      {children}
    </CatchesContext.Provider>
  )
}
