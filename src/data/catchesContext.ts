import { createContext, type Dispatch, type SetStateAction } from "react"
import type { CatchRecord } from "./catchData"

export type CatchesContextValue = {
  catches: CatchRecord[]
  setCatches: Dispatch<SetStateAction<CatchRecord[]>>
}

export const CatchesContext = createContext<CatchesContextValue | null>(null)
