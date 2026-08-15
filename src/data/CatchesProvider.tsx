import { useEffect, useMemo, useState, type ReactNode } from "react"
import type { CatchRecord } from "./catchData"
import { CatchesContext } from "./catchesContext"

function toNumberOrNull(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return null
  }

  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function loadCatches(): CatchRecord[] {
  const savedCatches = localStorage.getItem("catches")

  if (!savedCatches) {
    return []
  }

  try {
    const parsedCatches: unknown = JSON.parse(savedCatches)

    if (!Array.isArray(parsedCatches)) {
      return []
    }

    return parsedCatches.map((fish) => {
      const catchRecord = fish as CatchRecord

      return {
        ...catchRecord,
        length: toNumberOrNull(catchRecord.length),
        weight: toNumberOrNull(catchRecord.weight),
      }
    })
  } catch {
    return []
  }
}

export function CatchesProvider({ children }: { children: ReactNode }) {
  const [catches, setCatches] = useState<CatchRecord[]>(loadCatches)

  useEffect(() => {
    try {
      localStorage.setItem("catches", JSON.stringify(catches))
    } catch (error) {
      console.warn("Catches could not be saved locally.", error)
    }
  }, [catches])

  const value = useMemo(() => ({ catches, setCatches }), [catches])

  return (
    <CatchesContext.Provider value={value}>
      {children}
    </CatchesContext.Provider>
  )
}
