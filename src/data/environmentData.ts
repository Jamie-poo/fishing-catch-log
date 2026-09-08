type OpenMeteoResponse = {
  current?: {
    time?: string
    temperature_2m?: number
    relative_humidity_2m?: number
    is_day?: number
    precipitation?: number
    rain?: number
    cloud_cover?: number
    pressure_msl?: number
    wind_speed_10m?: number
    wind_direction_10m?: number
    weather_code?: number
  }
  hourly?: {
    time?: string[]
    pressure_msl?: number[]
    precipitation?: number[]
    rain?: number[]
    visibility?: number[]
  }
  daily?: {
    time?: string[]
    sunrise?: string[]
    sunset?: string[]
    moonrise?: string[]
    moonset?: string[]
    moon_phase?: number[]
  }
}

export type EnvironmentFormValues = Record<string, string>
export type PressureTrendHours = 3 | 6 | 12 | 24 | 72

const PRESSURE_TREND_HOURS: PressureTrendHours[] = [3, 6, 12, 24, 72]

function formatNumber(value: number | undefined, unit: string) {
  if (value === undefined) return ""
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(1))
  return `${rounded} ${unit}`
}

function formatTemperature(value: number | undefined) {
  if (value === undefined) return ""
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(1))
  return `${rounded} °C`
}

function formatPercent(value: number | undefined) {
  if (value === undefined) return ""
  return `${Math.round(value)}%`
}

function formatWindDirection(degrees: number | undefined) {
  if (degrees === undefined) return ""
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
  const index = Math.round(degrees / 45) % directions.length
  return directions[index]
}

function formatLocalTime(value: string | undefined) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatMoonPhase(phase: number | undefined) {
  if (phase === undefined) return ""

  if (phase < 0.03 || phase > 0.97) return "New moon"
  if (phase < 0.22) return "Waxing crescent"
  if (phase < 0.28) return "First quarter"
  if (phase < 0.47) return "Waxing gibbous"
  if (phase < 0.53) return "Full moon"
  if (phase < 0.72) return "Waning gibbous"
  if (phase < 0.78) return "Last quarter"
  return "Waning crescent"
}

function formatMoonIllumination(phase: number | undefined) {
  if (phase === undefined) return ""
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2
  return `${Math.round(illumination * 100)}%`
}

function formatWeatherCode(code: number | undefined) {
  if (code === undefined) return ""

  if (code === 0) return "Clear"
  if (code === 1) return "Mostly clear"
  if (code === 2) return "Partly cloudy"
  if (code === 3) return "Cloudy"
  if (code === 45 || code === 48) return "Fog"
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle"
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain"
  if ([71, 73, 75, 77].includes(code)) return "Snow"
  if ([80, 81, 82].includes(code)) return "Showers"
  if ([85, 86].includes(code)) return "Snow showers"
  if ([95, 96, 99].includes(code)) return "Thunderstorm"

  return "Weather recorded"
}

function findNearestHourlyIndex(times: string[] | undefined, referenceTime?: string) {
  if (!times?.length) return -1

  const reference = referenceTime ? new Date(referenceTime).getTime() : Date.now()
  if (Number.isNaN(reference)) return -1

  return times.reduce((nearestIndex, time, index) => {
    const value = new Date(time).getTime()
    if (Number.isNaN(value)) return nearestIndex

    const nearestValue = new Date(times[nearestIndex]).getTime()
    if (Number.isNaN(nearestValue)) return index

    return Math.abs(value - reference) < Math.abs(nearestValue - reference) ? index : nearestIndex
  }, 0)
}

function getHourlyValue(values: number[] | undefined, index: number) {
  if (!values || index < 0 || index >= values.length) return undefined
  return values[index]
}

function getHourlyRain(hourly: OpenMeteoResponse["hourly"], index: number) {
  return getHourlyValue(hourly?.rain, index) ?? getHourlyValue(hourly?.precipitation, index)
}

function formatVisibility(value: number | undefined) {
  if (value === undefined) return ""
  if (value >= 1000) {
    const kilometers = value / 1000
    const rounded = kilometers >= 10 ? Math.round(kilometers) : Number(kilometers.toFixed(1))
    return `${rounded} km`
  }

  return `${Math.round(value)} m`
}

function formatDuration(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.round(milliseconds / 60_000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  }

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  return `${minutes}m`
}

function formatTimeSinceLastRain(hourly: OpenMeteoResponse["hourly"], currentTime?: string) {
  const currentIndex = findNearestHourlyIndex(hourly?.time, currentTime)
  if (!hourly?.time?.length || currentIndex < 0) return ""

  for (let index = currentIndex; index >= 0; index -= 1) {
    const rainAmount = getHourlyRain(hourly, index) ?? 0
    if (rainAmount <= 0) continue

    if (index === currentIndex) return "Raining now"

    const current = currentTime ? new Date(currentTime).getTime() : Date.now()
    const lastRain = new Date(hourly.time[index]).getTime()
    if (Number.isNaN(current) || Number.isNaN(lastRain)) return ""

    return `${formatDuration(current - lastRain)} ago`
  }

  return "No rain in last 7d"
}

function formatRecentRainAmount(hourly: OpenMeteoResponse["hourly"], currentTime?: string) {
  const currentIndex = findNearestHourlyIndex(hourly?.time, currentTime)
  if (!hourly?.time?.length || currentIndex < 0) return ""

  const current = currentTime ? new Date(currentTime).getTime() : Date.now()
  if (Number.isNaN(current)) return ""

  const dayAgo = current - 24 * 60 * 60 * 1000
  const total = hourly.time.reduce((sum, time, index) => {
    const valueTime = new Date(time).getTime()
    if (Number.isNaN(valueTime) || valueTime < dayAgo || valueTime > current) return sum
    return sum + (getHourlyRain(hourly, index) ?? 0)
  }, 0)

  const rounded = Number(total.toFixed(1))
  return `${rounded} mm last 24h`
}

function findDailyIndex(times: string[] | undefined, referenceTime?: string) {
  if (!times?.length) return 0

  const dateKey = referenceTime?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
  const matchingIndex = times.findIndex((time) => time === dateKey)
  return matchingIndex === -1 ? 0 : matchingIndex
}

function formatTimeRelativeToEvent(referenceTime: string | undefined, eventTime: string | undefined, eventLabel: string) {
  if (!eventTime) return ""

  const reference = referenceTime ? new Date(referenceTime).getTime() : Date.now()
  const event = new Date(eventTime).getTime()
  if (Number.isNaN(reference) || Number.isNaN(event)) return ""

  const difference = reference - event
  const timing = difference >= 0 ? "after" : "before"
  return `${formatDuration(Math.abs(difference))} ${timing} ${eventLabel}`
}

function formatPressureTrend(
  currentPressure: number | undefined,
  hourlyTimes: string[] | undefined,
  hourlyPressure: number[] | undefined,
  currentTime: string | undefined,
  trendHours: number
) {
  const currentIndex = findNearestHourlyIndex(hourlyTimes, currentTime)
  const startingPressure = currentPressure ?? getHourlyValue(hourlyPressure, currentIndex)
  if (startingPressure === undefined || !hourlyPressure?.length || currentIndex < 0) return ""

  const current = currentTime ? new Date(currentTime).getTime() : Date.now()
  if (Number.isNaN(current)) return ""

  const trendTime = current - trendHours * 60 * 60 * 1000
  const trendIndex = findNearestHourlyIndex(
    hourlyTimes,
    new Date(trendTime).toISOString()
  )
  const previousPressure = getHourlyValue(hourlyPressure, trendIndex)
  if (previousPressure === undefined || trendIndex === currentIndex) return ""

  const trendTimestamp = hourlyTimes?.[trendIndex]
    ? new Date(hourlyTimes[trendIndex]).getTime()
    : trendTime
  const hours = Math.max(
    1,
    Math.round(Math.abs(current - trendTimestamp) / (60 * 60 * 1000))
  )
  const difference = Number((startingPressure - previousPressure).toFixed(1))
  const direction = Math.abs(difference) < 0.5 ? "Steady" : difference > 0 ? "Rising" : "Falling"
  const signedDifference = difference > 0 ? `+${difference}` : String(difference)

  const periodLabel = hours === 72 ? "3d" : `${hours}h`

  return `${direction} (${signedDifference} hPa over ${periodLabel})`
}

function formatPressureTrendBreakdown(
  currentPressure: number | undefined,
  hourlyTimes: string[] | undefined,
  hourlyPressure: number[] | undefined,
  currentTime: string | undefined,
  defaultTrendHours: PressureTrendHours
) {
  return PRESSURE_TREND_HOURS
    .filter((hours) => hours !== defaultTrendHours)
    .map((hours) => formatPressureTrend(currentPressure, hourlyTimes, hourlyPressure, currentTime, hours))
    .filter(Boolean)
    .join("\n")
}

export async function getAutomaticEnvironmentData(
  latitude: number,
  longitude: number,
  defaultPressureTrendHours: PressureTrendHours = 12
): Promise<EnvironmentFormValues> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "is_day",
      "precipitation",
      "rain",
      "cloud_cover",
      "pressure_msl",
      "wind_speed_10m",
      "wind_direction_10m",
      "weather_code",
    ].join(","),
    hourly: ["pressure_msl", "precipitation", "rain", "visibility"].join(","),
    daily: ["sunrise", "sunset", "moonrise", "moonset", "moon_phase"].join(","),
    past_days: "7",
    forecast_days: "4",
    timezone: "auto",
  })
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)

  if (!response.ok) {
    throw new Error("Weather service did not respond")
  }

  const data = (await response.json()) as OpenMeteoResponse
  const current = data.current ?? {}
  const hourly = data.hourly ?? {}
  const daily = data.daily ?? {}
  const dailyIndex = findDailyIndex(daily.time, current.time)
  const moonPhase = daily.moon_phase?.[dailyIndex]
  const hourlyIndex = findNearestHourlyIndex(hourly.time, current.time)
  const sunrise = daily.sunrise?.[dailyIndex]
  const sunset = daily.sunset?.[dailyIndex]
  const moonrise = daily.moonrise?.[dailyIndex]
  const moonset = daily.moonset?.[dailyIndex]

  return {
    "weather.conditions": formatWeatherCode(current.weather_code),
    "weather.temperature": formatTemperature(current.temperature_2m),
    "weather.rain": formatNumber(current.rain ?? current.precipitation, "mm"),
    "weather.timeSinceLastRain": formatTimeSinceLastRain(hourly, current.time),
    "weather.recentRainAmount": formatRecentRainAmount(hourly, current.time),
    "weather.cloudCover": formatPercent(current.cloud_cover),
    "weather.windDirection": formatWindDirection(current.wind_direction_10m),
    "weather.windSpeed": formatNumber(current.wind_speed_10m, "km/h"),
    "weather.pressure": formatNumber(current.pressure_msl, "hPa"),
    "weather.pressureTrend": formatPressureTrend(
      current.pressure_msl,
      hourly.time,
      hourly.pressure_msl,
      current.time,
      defaultPressureTrendHours
    ),
    "weather.pressureTrendBreakdown": formatPressureTrendBreakdown(
      current.pressure_msl,
      hourly.time,
      hourly.pressure_msl,
      current.time,
      defaultPressureTrendHours
    ),
    "weather.humidity": formatPercent(current.relative_humidity_2m),
    "weather.visibility": formatVisibility(getHourlyValue(hourly.visibility, hourlyIndex)),
    "sun.sunrise": formatLocalTime(sunrise),
    "sun.sunset": formatLocalTime(sunset),
    "sun.dayNight": current.is_day === undefined ? "" : current.is_day ? "Day" : "Night",
    "sun.relativeToSunrise": formatTimeRelativeToEvent(current.time, sunrise, "sunrise"),
    "sun.relativeToSunset": formatTimeRelativeToEvent(current.time, sunset, "sunset"),
    "moon.moonPhase": formatMoonPhase(moonPhase),
    "moon.moonIllumination": formatMoonIllumination(moonPhase),
    "moon.moonrise": formatLocalTime(moonrise),
    "moon.moonset": formatLocalTime(moonset),
    "moon.relativeToMoonrise": formatTimeRelativeToEvent(current.time, moonrise, "moonrise"),
    "moon.relativeToMoonset": formatTimeRelativeToEvent(current.time, moonset, "moonset"),
  }
}
