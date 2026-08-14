import { useContext } from "react"
import { CatchesContext } from "./catchesContext"

export function useCatches() {
  const context = useContext(CatchesContext)

  if (!context) {
    throw new Error("useCatches must be used inside CatchesProvider")
  }

  return context
}
