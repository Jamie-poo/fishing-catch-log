import { createContext } from "react"

export type LengthUnit = "cm" | "in"
export type WeightUnit = "kg" | "lb-oz"
export type DepthUnit = "m" | "ft"
export type PressureTrendHours = 3 | 6 | 12 | 24 | 72

export type VisibilitySettings = {
  groups: Record<string, boolean>
  fields: Record<string, boolean>
  mapFilters: Record<string, boolean>
  mapWeatherConditions: Record<string, boolean>
  lengthUnit: LengthUnit
  weightUnit: WeightUnit
  depthUnit: DepthUnit
  pressureTrendHours: PressureTrendHours
}

export type SettingsContextValue = VisibilitySettings & {
  setGroupVisible: (key: string, visible: boolean) => void
  setFieldVisible: (groupKey: string, fieldKey: string, visible: boolean) => void
  setMapFilterVisible: (key: string, visible: boolean) => void
  setMapWeatherConditionVisible: (key: string, visible: boolean) => void
  setLengthUnit: (unit: LengthUnit) => void
  setWeightUnit: (unit: WeightUnit) => void
  setDepthUnit: (unit: DepthUnit) => void
  setPressureTrendHours: (hours: PressureTrendHours) => void
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)
