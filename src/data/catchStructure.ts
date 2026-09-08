export type CatchField = {
  key: string
  label: string
  type?: "text" | "number" | "datetime-local" | "textarea"
}

export type CatchFieldGroup = {
  key: string
  label: string
  section: "header" | "environment" | "information" | "journal"
  automatic?: boolean
  fields: CatchField[]
}

export const catchFieldGroups: CatchFieldGroup[] = [
  {
    key: "header",
    label: "Header",
    section: "header",
    fields: [
      { key: "fishPhoto", label: "Fish photo" },
      { key: "species", label: "Species" },
      { key: "length", label: "Length (cm)", type: "number" },
      { key: "weight", label: "Weight (kg)", type: "number" },
      { key: "locationName", label: "Location name" },
      { key: "dateTime", label: "Date and time", type: "datetime-local" },
    ],
  },
  {
    key: "weather",
    label: "Weather Conditions",
    section: "environment",
    automatic: true,
    fields: [
      { key: "conditions", label: "Conditions" },
      { key: "temperature", label: "Temperature" },
      { key: "rain", label: "Rain" },
      { key: "timeSinceLastRain", label: "Time since last rain" },
      { key: "recentRainAmount", label: "Recent rainfall amount" },
      { key: "cloudCover", label: "Cloud cover" },
      { key: "windDirection", label: "Wind direction" },
      { key: "windSpeed", label: "Wind speed" },
      { key: "pressure", label: "Atmospheric pressure" },
      { key: "pressureTrend", label: "Pressure trend" },
      { key: "pressureTrendBreakdown", label: "Pressure trend details", type: "textarea" },
      { key: "humidity", label: "Humidity" },
      { key: "visibility", label: "Visibility" },
    ],
  },
  {
    key: "sun",
    label: "Sun",
    section: "environment",
    automatic: true,
    fields: [
      { key: "sunrise", label: "Sunrise" },
      { key: "sunset", label: "Sunset" },
      { key: "dayNight", label: "Day / night" },
      { key: "relativeToSunrise", label: "Time relative to sunrise" },
      { key: "relativeToSunset", label: "Time relative to sunset" },
    ],
  },
  {
    key: "moon",
    label: "Moon",
    section: "environment",
    automatic: true,
    fields: [
      { key: "moonPhase", label: "Moon phase" },
      { key: "moonIllumination", label: "Moon illumination" },
      { key: "moonrise", label: "Moonrise" },
      { key: "moonset", label: "Moonset" },
      { key: "relativeToMoonrise", label: "Time relative to moonrise" },
      { key: "relativeToMoonset", label: "Time relative to moonset" },
    ],
  },
  {
    key: "water",
    label: "Water",
    section: "environment",
    automatic: true,
    fields: [
      { key: "waterTemperature", label: "Water temperature" },
      { key: "flow", label: "Current / flow" },
      { key: "waterLevel", label: "Water level" },
      { key: "waterClarity", label: "Water clarity" },
      { key: "waterConditions", label: "Water conditions" },
      { key: "ph", label: "pH" },
      { key: "salinity", label: "Salinity" },
      { key: "otherWaterData", label: "Other available water data", type: "textarea" },
    ],
  },
  {
    key: "tides",
    label: "Tides",
    section: "environment",
    automatic: true,
    fields: [
      { key: "tideState", label: "Tide state" },
      { key: "tideHeight", label: "Tide height" },
      { key: "risingFalling", label: "Rising / falling" },
      { key: "highTideTime", label: "High tide time" },
      { key: "lowTideTime", label: "Low tide time" },
      { key: "relativeToTide", label: "Time relative to high / low tide" },
      { key: "tideHeightAtCatch", label: "Tide height at catch" },
    ],
  },
  {
    key: "method",
    label: "Method",
    section: "information",
    fields: [{ key: "method", label: "Method" }],
  },
  {
    key: "lure",
    label: "Lure",
    section: "information",
    fields: [
      { key: "name", label: "Lure name" }, { key: "type", label: "Lure type" },
      { key: "brand", label: "Brand" }, { key: "model", label: "Model" },
      { key: "size", label: "Size" }, { key: "colour", label: "Colour" },
      { key: "weight", label: "Weight" }, { key: "divingDepth", label: "Diving depth" },
      { key: "photo", label: "Photo of lure" },
    ],
  },
  {
    key: "bait",
    label: "Bait",
    section: "information",
    fields: [
      { key: "baitType", label: "Bait type" },
      { key: "specificBait", label: "Specific bait" },
      { key: "naturalArtificial", label: "Natural / artificial" },
    ],
  },
  {
    key: "fly",
    label: "Fly",
    section: "information",
    fields: [
      { key: "name", label: "Fly name" }, { key: "type", label: "Fly type" },
      { key: "brand", label: "Brand" }, { key: "model", label: "Model" },
      { key: "size", label: "Size" }, { key: "colour", label: "Colour" },
      { key: "weight", label: "Weight" }, { key: "divingDepth", label: "Diving depth" },
      { key: "photo", label: "Photo of fly" },
    ],
  },
  {
    key: "other",
    label: "Other",
    section: "information",
    fields: [{ key: "other", label: "Other", type: "textarea" }],
  },
  {
    key: "tackle",
    label: "Tackle Used",
    section: "information",
    fields: [
      { key: "rod", label: "Rod" }, { key: "reel", label: "Reel" },
      { key: "line", label: "Line" }, { key: "lineStrength", label: "Line strength" },
      { key: "leader", label: "Leader" }, { key: "hook", label: "Hook" },
      { key: "hookSize", label: "Hook size" }, { key: "rig", label: "Rig" },
      { key: "otherTackle", label: "Other tackle" },
    ],
  },
  {
    key: "circumstances",
    label: "Catch Circumstances",
    section: "information",
    fields: [
      { key: "structure", label: "Structure / snags" }, { key: "cover", label: "Cover" },
      { key: "depthFished", label: "Depth fished / estimated depth" },
      { key: "waterDepthDescription", label: "Water-depth description" },
      { key: "bottomType", label: "Bottom type" }, { key: "technique", label: "Technique / casting approach" },
      { key: "retrieveStyle", label: "Retrieve style" }, { key: "retrieveSpeed", label: "Retrieve speed" },
      { key: "currentObserved", label: "Current observed" }, { key: "hookedLocation", label: "Where fish was hooked" },
      { key: "strikeType", label: "Strike type" }, { key: "fightingBehaviour", label: "Fighting behaviour" },
      { key: "otherObservations", label: "Other observations", type: "textarea" },
    ],
  },
  {
    key: "journal",
    label: "Journal",
    section: "journal",
    fields: [
      { key: "catchNotes", label: "Catch notes", type: "textarea" },
      { key: "whatWorked", label: "What worked", type: "textarea" },
      { key: "whatDidNotWork", label: "What did not work", type: "textarea" },
      { key: "conditionsNoticed", label: "Conditions noticed", type: "textarea" },
      { key: "spotObservations", label: "Spot observations", type: "textarea" },
      { key: "storyMemory", label: "Story / memory", type: "textarea" },
    ],
  },
]

export function fieldId(groupKey: string, fieldKey: string) {
  return `${groupKey}.${fieldKey}`
}
