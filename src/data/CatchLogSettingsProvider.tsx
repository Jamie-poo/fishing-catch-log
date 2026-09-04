import { useEffect, useMemo, useState, type ReactNode } from "react"
import { catchFieldGroups, fieldId } from "./catchStructure"
import { defaultHomeMapControls } from "./homeMapControls"
import { defaultHomeSummary } from "./homeSummary"
import { defaultMapFilters } from "./mapFilters"
import { defaultMapWeatherConditions } from "./mapWeather"
import {
  SettingsContext,
  type DepthUnit,
  type LengthUnit,
  type PressureTrendHours,
  type VisibilitySettings,
  type WeightUnit,
} from "./catchLogSettingsContext"

function defaultSettings(): VisibilitySettings {
  return {
    groups: Object.fromEntries(
      catchFieldGroups.map((group) => [group.key, true])
    ),
    fields: Object.fromEntries(
      catchFieldGroups.flatMap((group) =>
        group.fields.map((field) => [fieldId(group.key, field.key), true])
      )
    ),
    homeMapControls: defaultHomeMapControls(),
    homeSummary: defaultHomeSummary(),
    mapFilters: defaultMapFilters(),
    mapWeatherConditions: defaultMapWeatherConditions(),
    lengthUnit: "cm",
    weightUnit: "kg",
    depthUnit: "m",
    pressureTrendHours: 12,
  }
}

function loadSettings(): VisibilitySettings {
  const saved = localStorage.getItem("catch-log-visibility")
  const defaults = defaultSettings()

  if (!saved) {
    return defaults
  }

  try {
    const parsed = JSON.parse(saved) as Partial<VisibilitySettings>

    return {
      ...defaults,
      ...parsed,
      groups: { ...defaults.groups, ...parsed.groups },
      fields: { ...defaults.fields, ...parsed.fields },
      homeMapControls: {
        ...defaults.homeMapControls,
        ...parsed.homeMapControls,
      },
      homeSummary: { ...defaults.homeSummary, ...parsed.homeSummary },
      mapFilters: { ...defaults.mapFilters, ...parsed.mapFilters },
      mapWeatherConditions: {
        ...defaults.mapWeatherConditions,
        ...parsed.mapWeatherConditions,
      },
    }
  } catch {
    return defaults
  }
}

export function CatchLogSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<VisibilitySettings>(loadSettings)

  useEffect(() => {
    localStorage.setItem("catch-log-visibility", JSON.stringify(settings))
  }, [settings])

  const value = useMemo(
    () => ({
      ...settings,
      setGroupVisible: (key: string, visible: boolean) =>
        setSettings((current) => ({
          ...current,
          groups: { ...current.groups, [key]: visible },
        })),
      setFieldVisible: (groupKey: string, fieldKey: string, visible: boolean) =>
        setSettings((current) => ({
          ...current,
          fields: { ...current.fields, [fieldId(groupKey, fieldKey)]: visible },
        })),
      setHomeMapControlVisible: (key: string, visible: boolean) =>
        setSettings((current) => ({
          ...current,
          homeMapControls: { ...current.homeMapControls, [key]: visible },
        })),
      setHomeSummaryVisible: (key: string, visible: boolean) =>
        setSettings((current) => ({
          ...current,
          homeSummary: { ...current.homeSummary, [key]: visible },
        })),
      setMapFilterVisible: (key: string, visible: boolean) =>
        setSettings((current) => ({
          ...current,
          mapFilters: { ...current.mapFilters, [key]: visible },
        })),
      setMapWeatherConditionVisible: (key: string, visible: boolean) =>
        setSettings((current) => ({
          ...current,
          mapWeatherConditions: {
            ...current.mapWeatherConditions,
            [key]: visible,
          },
        })),
      setLengthUnit: (lengthUnit: LengthUnit) =>
        setSettings((current) => ({ ...current, lengthUnit })),
      setWeightUnit: (weightUnit: WeightUnit) =>
        setSettings((current) => ({ ...current, weightUnit })),
      setDepthUnit: (depthUnit: DepthUnit) =>
        setSettings((current) => ({ ...current, depthUnit })),
      setPressureTrendHours: (pressureTrendHours: PressureTrendHours) =>
        setSettings((current) => ({ ...current, pressureTrendHours })),
    }),
    [settings]
  )

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}
