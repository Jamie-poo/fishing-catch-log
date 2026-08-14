import { useContext } from "react"
import { SettingsContext } from "./catchLogSettingsContext"

export function useCatchLogSettings() {
  const context = useContext(SettingsContext)

  if (!context) {
    throw new Error("useCatchLogSettings must be used inside CatchLogSettingsProvider")
  }

  return context
}
