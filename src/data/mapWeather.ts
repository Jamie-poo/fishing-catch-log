export type MapWeatherOption = {
  key: string
  label: string
}

export const mapWeatherOptions: MapWeatherOption[] = [
  { key: "weather.temperature", label: "Temperature" },
  { key: "weather.rain", label: "Rain" },
  { key: "weather.timeSinceLastRain", label: "Time since last rain" },
  { key: "weather.recentRainAmount", label: "Recent rainfall amount" },
  { key: "weather.cloudCover", label: "Cloud cover" },
  { key: "weather.windDirection", label: "Wind direction" },
  { key: "weather.windSpeed", label: "Wind speed" },
  { key: "weather.pressure", label: "Atmospheric pressure" },
  { key: "weather.pressureTrend", label: "Pressure trend" },
  { key: "weather.humidity", label: "Humidity" },
  { key: "weather.visibility", label: "Visibility" },
  { key: "sun.sunrise", label: "Sunrise" },
  { key: "sun.sunset", label: "Sunset" },
  { key: "sun.dayNight", label: "Day / night" },
  { key: "moon.moonPhase", label: "Moon phase" },
  { key: "moon.moonIllumination", label: "Moon illumination" },
]

export function defaultMapWeatherConditions() {
  return Object.fromEntries(mapWeatherOptions.map((option) => [option.key, true]))
}
