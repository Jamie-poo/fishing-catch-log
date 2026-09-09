import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import L from "leaflet"
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { getAutomaticEnvironmentData } from "../../data/environmentData"
import { formatLength, formatWeight } from "../../data/measurements"
import {
  formatCoordinateLocation,
  getLocationNameFromCoordinates,
} from "../../data/location"
import { mapWeatherOptions } from "../../data/mapWeather"
import {
  getMapItemTypeLabel,
  isLegacyWaypointForFieldNote,
  loadMapItems,
  loadStoredMapItems,
  mergeMapItems,
  saveMapItems,
  type SavedMapItem,
} from "../../data/mapItems"
import { useCatches } from "../../data/useCatches"
import { useCatchLogSettings } from "../../data/useCatchLogSettings"
import PhotoAddMenu from "../../components/PhotoAddMenu"
import { getCatchPhotos } from "../../data/catchPhotos"

const fishMarkerIcon = L.divIcon({
  className: "catch-fish-marker",
  html: `
    <span>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.5 12c2.8-3 6-4.5 9.5-4.5 2.4 0 4.5 1.1 6 3.1l2.2-2.1v7l-2.2-2.1c-1.5 2-3.6 3.1-6 3.1-3.5 0-6.7-1.5-9.5-4.5Z" />
        <circle cx="8" cy="11.2" r="0.9" />
      </svg>
    </span>
  `,
  iconSize: [34, 42],
  iconAnchor: [17, 42],
})

const currentLocationIcon = L.divIcon({
  className: "current-location-marker",
  html: "<span></span>",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

const pendingFieldNoteIcon = L.divIcon({
  className: "map-tool-marker pending-field-note-marker",
  html: "<span><b>N</b></span>",
  iconSize: [34, 42],
  iconAnchor: [17, 42],
})

const searchMarkerIcon = L.divIcon({
  className: "map-tool-marker search-result-marker",
  html: "<span><b>S</b></span>",
  iconSize: [34, 42],
  iconAnchor: [17, 42],
})

const intelMarkerIcon = L.divIcon({
  className: "map-tool-marker intel-target-marker",
  html: "<span><b>I</b></span>",
  iconSize: [34, 42],
  iconAnchor: [17, 42],
})

const weatherMarkerIcon = L.divIcon({
  className: "map-tool-marker weather-target-marker",
  html: "<span><b>W</b></span>",
  iconSize: [34, 42],
  iconAnchor: [17, 42],
})

const mapTiles = {
  standard: {
    attribution: "&copy; OpenStreetMap contributors",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  satellite: {
    attribution: "Tiles &copy; Esri",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  },
  topo: {
    attribution: "&copy; OpenTopoMap contributors",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  },
}

type HomeProps = {
  onOpenCatches: () => void
  onOpenCatchDetail: (catchId: number) => void
  onOpenStats: () => void
  onOpenCatchMap: () => void
  onOpenRecords: () => void
  onOpenFieldNotes: () => void
  onOpenFieldNoteDetail: (noteId: number) => void
  onOpenSettings: () => void
  onRecordCatch: () => void
}

type LocationPoint = {
  latitude: number
  longitude: number
}

type MapStyle = keyof typeof mapTiles

type MapTool = "browse" | "measure"

type MapViewportProps = {
  currentLocation: [number, number] | null
  points: [number, number][]
  recenterRequest: number
  searchRequest: number
  searchTarget: LocationPoint | null
}

type MapToolEventsProps = {
  activeTool: MapTool
  fieldNoteOpen: boolean
  intelOpen: boolean
  weatherOpen: boolean
  onCenterChange: (point: LocationPoint) => void
  onFieldNotePoint: (point: LocationPoint) => void
  onIntelPoint: (point: LocationPoint) => void
  onMapTap: () => void
  onMeasurePoint: (point: LocationPoint) => void
  onWeatherPoint: (point: LocationPoint) => void
}

type MapSearchResult = LocationPoint & {
  id: string
  label: string
  detail: string
  kind: "catch" | "note" | "place"
}

type CatchLocationPoint = {
  latitude: number | null
  longitude: number | null
  locationName?: string
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function getMapItemIcon(item: SavedMapItem, showNameLabel: boolean) {
  const title = showNameLabel ? item.title.trim() : ""
  const isFieldNote =
    item.type === "field-note" || item.type === "field-note-waypoint"
  const markerClass = isFieldNote ? "field-note-marker" : "waypoint-marker"
  const label = isFieldNote ? "N" : "W"

  return L.divIcon({
    className: [
      "map-tool-marker",
      markerClass,
      item.type === "field-note-waypoint" ? "field-note-waypoint-marker" : "",
      title ? "labeled-map-tool-marker" : "",
    ]
      .filter(Boolean)
      .join(" "),
    html: `<span><b>${label}</b></span>${
      title ? `<em>${escapeHtml(title)}</em>` : ""
    }`,
    iconSize: title ? [156, 64] : [34, 42],
    iconAnchor: [17, 42],
  })
}

function getCatchLocationKey(fish: CatchLocationPoint) {
  if (fish.latitude === null || fish.longitude === null) {
    return null
  }

  return `${fish.latitude.toFixed(5)},${fish.longitude.toFixed(5)}`
}

function getCurrentPosition() {
  return new Promise<LocationPoint>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GPS is not available"))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      reject,
      { enableHighAccuracy: true, maximumAge: 20_000, timeout: 12_000 }
    )
  })
}

function formatDistance(meters: number) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`
  }

  return `${Math.round(meters)} m`
}

function textMatchesSearch(value: string, query: string) {
  return value.toLowerCase().includes(query.toLowerCase())
}

function parseFirstNumber(value: string | undefined) {
  const match = value?.match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

function parseRelativeHours(value: string | undefined) {
  if (!value) return null

  const days = Number(value.match(/(\d+)d/)?.[1] ?? 0)
  const hours = Number(value.match(/(\d+)h/)?.[1] ?? 0)
  const minutes = Number(value.match(/(\d+)m/)?.[1] ?? 0)

  return days * 24 + hours + minutes / 60
}

function isNearLightChange(...values: (string | undefined)[]) {
  return values.some((value) => {
    const hours = parseRelativeHours(value)
    return hours !== null && hours <= 2.5
  })
}

function getCodSeasonNote(date = new Date()) {
  const month = date.getMonth()

  if (month >= 8 && month <= 10) {
    return "Closed season in many Victorian waters. Check VFA exceptions."
  }

  if (month === 11 || month <= 1) {
    return "Prime Victorian cod season"
  }

  if (month >= 2 && month <= 4) {
    return "Still worth targeting around low light"
  }

  return "Cooler season, expect deeper or slower fish"
}

function buildIntel(weatherValues: Record<string, string>) {
  const pressureTrend = weatherValues["weather.pressureTrend"] ?? ""
  const pressure = parseFirstNumber(weatherValues["weather.pressure"])
  const airTemperature = parseFirstNumber(weatherValues["weather.temperature"])
  const windSpeed = parseFirstNumber(weatherValues["weather.windSpeed"])
  const rain = parseFirstNumber(weatherValues["weather.rain"])
  const recentRain = parseFirstNumber(weatherValues["weather.recentRainAmount"])
  const dayNight = weatherValues["sun.dayNight"] ?? ""
  const nearLightChange = isNearLightChange(
    weatherValues["sun.relativeToSunrise"],
    weatherValues["sun.relativeToSunset"]
  )
  const seasonNote = getCodSeasonNote()
  let score = 46

  if (pressure !== null && pressure < 1000) score += 18
  if (pressure !== null && pressure >= 1018) score -= 8
  if (pressureTrend.includes("Steady")) score += 12
  if (pressureTrend.includes("Rising")) score += 8
  if (pressureTrend.includes("Falling")) score -= 8
  if (airTemperature !== null && airTemperature >= 16 && airTemperature <= 26) score += 10
  if (airTemperature !== null && airTemperature < 10) score -= 8
  if (airTemperature !== null && airTemperature > 32) score -= 8
  if (dayNight === "Night") score += 10
  if (nearLightChange) score += 10
  if (windSpeed !== null && windSpeed >= 4 && windSpeed <= 24) score += 6
  if (windSpeed !== null && windSpeed > 35) score -= 10
  if (rain !== null && rain > 5) score -= 6
  if (recentRain !== null && recentRain > 20) score -= 10
  if (seasonNote.startsWith("Prime")) score += 10
  if (seasonNote.startsWith("Cooler")) score -= 6

  const boundedScore = Math.min(95, Math.max(10, score))
  const label =
    boundedScore >= 75
      ? "Strong cod window"
      : boundedScore >= 58
        ? "Worth a cast"
        : "Patchy cod bite"
  const pressureSummary = pressureTrend || "Pressure trend unavailable"
  const windSummary =
    weatherValues["weather.windSpeed"] && weatherValues["weather.windDirection"]
      ? `${weatherValues["weather.windDirection"]} ${weatherValues["weather.windSpeed"]}`
      : weatherValues["weather.windSpeed"] || "Wind unavailable"
  const lightSummary = nearLightChange
    ? "near a light change"
    : dayNight === "Night"
      ? "after dark"
      : "daylight"

  return {
    label,
    score: boundedScore,
    summary: `Victorian Murray cod lens: ${pressureSummary}, ${lightSummary}. Work snags, edges and structure.`,
    rows: [
      ["Target", "Murray cod"],
      ["Season", seasonNote],
      ["Barometer", weatherValues["weather.pressure"] || "-"],
      ["Pressure trend", pressureTrend || "-"],
      ["Wind", windSummary],
      ["Light window", nearLightChange ? "Sunrise/sunset window" : dayNight || "-"],
      ["Rain / runoff", weatherValues["weather.recentRainAmount"] || weatherValues["weather.rain"] || "-"],
      ["Moon", `${weatherValues["moon.moonPhase"] || "-"} (low weight for cod)`],
    ],
  }
}

function buildElevationProfile(points: LocationPoint[]) {
  if (points.length < 2) return []

  const start = points[0]
  const base = Math.round(180 + Math.abs(start.latitude % 1) * 90)

  return Array.from({ length: 14 }, (_, index) => {
    const wave = Math.sin(index * 0.9 + start.longitude) * 34
    const smallerWave = Math.cos(index * 1.45 + start.latitude) * 18
    return Math.max(0, Math.round(base + wave + smallerWave + index * 2))
  })
}

function getElevationStats(profile: number[]) {
  if (profile.length === 0) {
    return { gain: 0, loss: 0, max: 0, min: 0, points: "" }
  }

  const gain = profile.slice(1).reduce((total, value, index) => {
    return total + Math.max(0, value - profile[index])
  }, 0)
  const loss = profile.slice(1).reduce((total, value, index) => {
    return total + Math.max(0, profile[index] - value)
  }, 0)
  const max = Math.max(...profile)
  const min = Math.min(...profile)
  const range = Math.max(1, max - min)
  const points = profile
    .map((value, index) => {
      const x = profile.length === 1 ? 0 : (index / (profile.length - 1)) * 100
      const y = 55 - ((value - min) / range) * 46
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(" ")

  return { gain, loss, max, min, points }
}

function getBrowserSpeechRecognition() {
  type Recognition = {
    lang: string
    interimResults: boolean
    onresult: (event: {
      results: ArrayLike<ArrayLike<{ transcript: string }>>
    }) => void
    onerror: () => void
    start: () => void
  }
  type RecognitionConstructor = new () => Recognition
  const browserWindow = window as Window & {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }

  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition
}

function MapViewport({
  currentLocation,
  points,
  recenterRequest,
  searchRequest,
  searchTarget,
}: MapViewportProps) {
  const map = useMap()
  const hasSetInitialView = useRef(false)
  const currentLocationRef = useRef(currentLocation)

  useEffect(() => {
    currentLocationRef.current = currentLocation
  }, [currentLocation])

  useEffect(() => {
    if (hasSetInitialView.current) {
      return
    }

    if (points.length > 0) {
      hasSetInitialView.current = true
      map.fitBounds(points, { padding: [44, 44], maxZoom: 13 })
    }
  }, [map, points])

  useEffect(() => {
    const latestLocation = currentLocationRef.current

    if (!latestLocation || recenterRequest === 0) {
      return
    }

    map.flyTo(latestLocation, Math.max(map.getZoom(), 15))
  }, [map, recenterRequest])

  useEffect(() => {
    if (!searchTarget || searchRequest === 0) {
      return
    }

    map.flyTo([searchTarget.latitude, searchTarget.longitude], Math.max(map.getZoom(), 15))
  }, [map, searchRequest, searchTarget])

  return null
}

function MapToolEvents({
  activeTool,
  fieldNoteOpen,
  intelOpen,
  weatherOpen,
  onCenterChange,
  onFieldNotePoint,
  onIntelPoint,
  onMapTap,
  onMeasurePoint,
  onWeatherPoint,
}: MapToolEventsProps) {
  const suppressTapUntil = useRef(0)
  const map = useMapEvents({
    click(event) {
      if (Date.now() < suppressTapUntil.current) {
        return
      }

      const point = {
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      }

      if (activeTool === "measure") {
        onMeasurePoint(point)
        return
      }

      if (fieldNoteOpen) {
        onFieldNotePoint(point)
        return
      }

      onMapTap()
    },
    moveend() {
      const center = map.getCenter()
      onCenterChange({
        latitude: center.lat,
        longitude: center.lng,
      })
    },
    contextmenu(event) {
      event.originalEvent.preventDefault()
      event.originalEvent.stopPropagation()
      window.getSelection()?.removeAllRanges()

      if (!intelOpen && !weatherOpen) {
        return
      }

      suppressTapUntil.current = Date.now() + 850
      const point = {
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      }

      if (intelOpen) {
        onIntelPoint(point)
        return
      }

      onWeatherPoint(point)
    },
  })

  useEffect(() => {
    const center = map.getCenter()
    onCenterChange({
      latitude: center.lat,
      longitude: center.lng,
    })
  }, [map, onCenterChange])

  useEffect(() => {
    const container = map.getContainer()
    const preventSelection = (event: Event) => {
      event.preventDefault()
      window.getSelection()?.removeAllRanges()
    }

    container.addEventListener("selectstart", preventSelection)
    container.addEventListener("contextmenu", preventSelection, { capture: true })

    return () => {
      container.removeEventListener("selectstart", preventSelection)
      container.removeEventListener("contextmenu", preventSelection, { capture: true })
    }
  }, [map])

  return null
}

function Home({
  onOpenCatches,
  onOpenCatchDetail,
  onOpenStats,
  onOpenCatchMap,
  onOpenRecords,
  onOpenFieldNotes,
  onOpenFieldNoteDetail,
  onOpenSettings,
  onRecordCatch,
}: HomeProps) {
  const { catches } = useCatches()
  const {
    homeMapControls,
    homeMapDisplay,
    homeSearch,
    homeSummary,
    fieldNoteConditions,
    lengthUnit,
    mapWeatherConditions,
    pressureTrendHours,
    weightUnit,
  } = useCatchLogSettings()
  const canUseGeolocation =
    typeof navigator !== "undefined" && "geolocation" in navigator
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(
    null
  )
  const [locationTitle, setLocationTitle] = useState(
    canUseGeolocation ? "Finding location..." : "Location unavailable"
  )
  const [locationStatus, setLocationStatus] = useState(
    canUseGeolocation ? "current location" : "GPS unavailable"
  )
  const [mapSearchQuery, setMapSearchQuery] = useState("")
  const [placeSearchResults, setPlaceSearchResults] = useState<MapSearchResult[]>([])
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchRequest, setSearchRequest] = useState(0)
  const [selectedSearchResult, setSelectedSearchResult] =
    useState<MapSearchResult | null>(null)
  const [recenterRequest, setRecenterRequest] = useState(0)
  const [mapCenter, setMapCenter] = useState<LocationPoint>({
    latitude: -37.25,
    longitude: 144.9,
  })
  const [mapStyle, setMapStyle] = useState<MapStyle>("satellite")
  const [layersOpen, setLayersOpen] = useState(false)
  const [activeTool, setActiveTool] = useState<MapTool>("browse")
  const [weatherValues, setWeatherValues] = useState<Record<string, string>>({})
  const [weatherOpen, setWeatherOpen] = useState(false)
  const [weatherPoint, setWeatherPoint] = useState<LocationPoint | null>(null)
  const [weatherLocationName, setWeatherLocationName] = useState("")
  const [weatherStatus, setWeatherStatus] = useState("")
  const [intelOpen, setIntelOpen] = useState(false)
  const [intelPoint, setIntelPoint] = useState<LocationPoint | null>(null)
  const [intelLocationName, setIntelLocationName] = useState("")
  const [mapItems, setMapItems] = useState<SavedMapItem[]>(loadMapItems)
  const nextMapItemId = useRef(
    Math.max(0, ...mapItems.map((item) => item.id)) + 1
  )
  const [fieldNoteOpen, setFieldNoteOpen] = useState(false)
  const [fieldNotePoint, setFieldNotePoint] = useState<LocationPoint | null>(null)
  const [fieldNoteTitle, setFieldNoteTitle] = useState("Field Note / Pin")
  const [fieldNoteText, setFieldNoteText] = useState("")
  const [fieldNotePhotos, setFieldNotePhotos] = useState<string[]>([])
  const [fieldNoteConditionValues, setFieldNoteConditionValues] = useState<
    Record<string, string>
  >({})
  const [fieldNoteConditionStatus, setFieldNoteConditionStatus] = useState("")
  const [editingMapItemId, setEditingMapItemId] = useState<number | null>(null)
  const [measurePoints, setMeasurePoints] = useState<LocationPoint[]>([])
  const [catchLocationNames, setCatchLocationNames] = useState<Record<string, string>>({})
  const lastCatchPopupTap = useRef<{ id: number; time: number } | null>(null)
  const lastMapItemPopupTap = useRef<{ id: number; time: number } | null>(null)

  const mappedCatches = catches.filter(
    (fish) => fish.latitude !== null && fish.longitude !== null
  )

  const points = useMemo(
    () =>
      mappedCatches.map(
        (fish) => [fish.latitude!, fish.longitude!] as [number, number]
      ),
    [mappedCatches]
  )

  const speciesCount = new Set(
    catches.map((fish) => fish.species.trim()).filter(Boolean)
  ).size

  const selectedTiles = mapTiles[mapStyle]
  const visibleWeather = mapWeatherOptions.filter(
    (condition) => mapWeatherConditions[condition.key] ?? true
  )
  const measureDistance = useMemo(
    () =>
      measurePoints.slice(1).reduce((total, point, index) => {
        const previousPoint = measurePoints[index]
        return total + L.latLng(previousPoint.latitude, previousPoint.longitude).distanceTo(
          L.latLng(point.latitude, point.longitude)
        )
      }, 0),
    [measurePoints]
  )
  const elevationProfile = useMemo(
    () => buildElevationProfile(measurePoints),
    [measurePoints]
  )
  const elevationStats = useMemo(
    () => getElevationStats(elevationProfile),
    [elevationProfile]
  )
  const intel = useMemo(() => buildIntel(weatherValues), [weatherValues])
  const visibleFieldNoteConditions = mapWeatherOptions.filter(
    (condition) => fieldNoteConditions[condition.key] ?? true
  )
  const noteConditionRows = visibleFieldNoteConditions.map((condition) => ({
    label: condition.label,
    value: fieldNoteConditionValues[condition.key] || "-",
  }))
  const visibleMapItems = useMemo(
    () => mapItems.filter((item) => !isLegacyWaypointForFieldNote(item, mapItems)),
    [mapItems]
  )
  const visibleMapMarkers = useMemo(
    () =>
      visibleMapItems.filter(
        (item) => !(fieldNoteOpen && editingMapItemId === item.id)
      ),
    [editingMapItemId, fieldNoteOpen, visibleMapItems]
  )

  const getCatchDisplayLocation = useCallback((fish: CatchLocationPoint) => {
    const locationKey = getCatchLocationKey(fish)

    if (!locationKey) {
      return fish.locationName || "Location saved"
    }

    return catchLocationNames[locationKey] || "Location saved"
  }, [catchLocationNames])

  const localSearchResults = useMemo(() => {
    const query = mapSearchQuery.trim()

    if (query.length < 2) {
      return []
    }

    const catchResults = (homeSearch.catches ?? true)
        ? mappedCatches
            .filter((fish) =>
              textMatchesSearch(
                [
                  fish.species,
                  getCatchDisplayLocation(fish),
                  fish.notes,
                  formatLength(fish.length, lengthUnit),
                  formatWeight(fish.weight, weightUnit),
                  new Date(fish.dateTime).toLocaleString(),
                ]
                  .filter(Boolean)
                  .join(" "),
                query
              )
            )
            .slice(0, 4)
            .map<MapSearchResult>((fish) => ({
              id: `catch-${fish.id}`,
              kind: "catch",
              label: fish.species || "Saved catch",
              detail: [
                getCatchDisplayLocation(fish),
                formatLength(fish.length, lengthUnit),
                formatWeight(fish.weight, weightUnit),
              ].join(" · "),
              latitude: fish.latitude!,
              longitude: fish.longitude!,
            }))
        : []

    const noteResults = (homeSearch.notes ?? true)
        ? visibleMapItems
            .filter((item) =>
              textMatchesSearch(
                [
                  item.title,
                  item.note,
                  item.category,
                  getMapItemTypeLabel(item),
                  ...(item.conditions?.flatMap((condition) => [
                    condition.label,
                    condition.value,
                  ]) ?? []),
                ]
                  .filter(Boolean)
                  .join(" "),
                query
              )
            )
            .slice(0, 4)
            .map<MapSearchResult>((item) => ({
              id: `note-${item.id}`,
              kind: "note",
              label: item.title || getMapItemTypeLabel(item),
              detail: item.note || getMapItemTypeLabel(item),
              latitude: item.latitude,
              longitude: item.longitude,
            }))
        : []

    return [...noteResults, ...catchResults].slice(0, 7)
  }, [
    homeSearch.catches,
    homeSearch.notes,
    lengthUnit,
    mapSearchQuery,
    mappedCatches,
    visibleMapItems,
    weightUnit,
    getCatchDisplayLocation,
  ])
  const visibleSearchResults = [
    ...localSearchResults,
    ...(mapSearchQuery.trim().length >= 3 && (homeSearch.places ?? true)
      ? placeSearchResults.filter(
          (place) => !localSearchResults.some((result) => result.id === place.id)
        )
      : []),
  ].slice(0, 8)
  const showSearchResults =
    searchFocused &&
    mapSearchQuery.trim().length > 1 &&
    visibleSearchResults.length > 0
  const summaryEnabled = homeSummary.panel ?? true
  const summaryCopyEnabled =
    (homeSummary.location ?? true) || (homeSummary.gpsStatus ?? true)
  const searchEnabled = homeSummary.search ?? true
  const summaryMetrics = [
    {
      key: "time",
      label: "time",
      value: new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
    },
    { key: "logged", label: "logged", value: catches.length },
    { key: "species", label: "species", value: speciesCount },
  ].filter((metric) => homeSummary[metric.key] ?? true)
  const showSummaryMetrics =
    summaryMetrics.length > 0 || (homeSummary.mapButton ?? true)

  useEffect(() => {
    let isMounted = true

    loadStoredMapItems()
      .then((storedItems) => {
        if (!isMounted) return

        setMapItems((currentItems) => {
          const mergedItems = mergeMapItems(storedItems, currentItems)
          nextMapItemId.current =
            Math.max(0, ...mergedItems.map((item) => item.id)) + 1
          return mergedItems
        })
      })
      .catch((error) => {
        console.warn("Map pins could not be loaded from device storage.", error)
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!canUseGeolocation) {
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation: [number, number] = [
          position.coords.latitude,
          position.coords.longitude,
        ]

        setCurrentLocation(nextLocation)
        setLocationStatus("current location")
      },
      () => {
        setLocationTitle("Location unavailable")
        setLocationStatus("allow location")
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 12_000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [canUseGeolocation])

  useEffect(() => {
    const lookups = mappedCatches.reduce<
      { key: string; latitude: number; longitude: number }[]
    >((current, fish) => {
      const key = getCatchLocationKey(fish)

      if (
        !key ||
        catchLocationNames[key] ||
        fish.latitude === null ||
        fish.longitude === null
      ) {
        return current
      }

      current.push({
        key,
        latitude: fish.latitude,
        longitude: fish.longitude,
      })
      return current
    }, [])

    if (lookups.length === 0) {
      return
    }

    const controller = new AbortController()

    Promise.all(
      lookups.map(async (lookup) => {
        const name = await getLocationNameFromCoordinates(
          lookup.latitude,
          lookup.longitude,
          controller.signal
        )

        return [lookup.key, name] as const
      })
    )
      .then((names) => {
        if (controller.signal.aborted) {
          return
        }

        setCatchLocationNames((current) => {
          const next = { ...current }
          let changed = false

          names.forEach(([key, name]) => {
            if (!next[key]) {
              next[key] = name
              changed = true
            }
          })

          return changed ? next : current
        })
      })
      .catch(() => undefined)

    return () => controller.abort()
  }, [catchLocationNames, mappedCatches])

  useEffect(() => {
    if (!currentLocation) {
      return
    }

    const controller = new AbortController()
    const [latitude, longitude] = currentLocation

    getLocationNameFromCoordinates(latitude, longitude, controller.signal)
      .then(setLocationTitle)
      .catch(() => {
        if (!controller.signal.aborted) {
          setLocationTitle("Current location")
        }
      })

    return () => controller.abort()
  }, [currentLocation])

  useEffect(() => {
    const query = mapSearchQuery.trim()

    if (query.length < 3 || !(homeSearch.places ?? true)) return

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({
        format: "jsonv2",
        limit: "5",
        countrycodes: "au",
        q: query,
      })

      if (currentLocation) {
        const [latitude, longitude] = currentLocation
        params.set(
          "viewbox",
          `${longitude - 1},${latitude + 1},${longitude + 1},${latitude - 1}`
        )
        params.set("bounded", "0")
      }

      fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : []))
        .then(
          (
            results: Array<{
              display_name?: string
              lat?: string
              lon?: string
              place_id?: number
              osm_id?: number
              type?: string
            }>
          ) => {
            if (controller.signal.aborted) {
              return
            }

            const places = results.reduce<MapSearchResult[]>(
              (current, result, index) => {
                const latitude = Number(result.lat)
                const longitude = Number(result.lon)

                if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                  return current
                }

                const displayName = result.display_name ?? "Map place"
                const [label, ...detailParts] = displayName.split(", ")

                current.push({
                  id: `place-${result.place_id ?? result.osm_id ?? index}`,
                  kind: "place",
                  label,
                  detail:
                    detailParts.slice(0, 3).join(", ") ||
                    result.type ||
                    "Place",
                  latitude,
                  longitude,
                })

                return current
              },
              []
            )

            setPlaceSearchResults(places)
          }
        )
        .catch(() => {
          if (!controller.signal.aborted) {
            setPlaceSearchResults([])
          }
        })
    }, 450)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [currentLocation, homeSearch.places, mapSearchQuery])

  async function loadWeatherValues(
    statusLabel: string,
    targetLocation?: LocationPoint,
    successLabel = "Current weather",
    targetKind: "weather" | "intel" = "weather"
  ) {
    setWeatherStatus(statusLabel)

    try {
      const location = targetLocation ?? await getCurrentPosition()

      if (!targetLocation) {
        setCurrentLocation([location.latitude, location.longitude])
      }

      const values = await getAutomaticEnvironmentData(
        location.latitude,
        location.longitude,
        pressureTrendHours
      )
      let nextStatus = successLabel

      if (targetLocation) {
        try {
          const locationName = await getLocationNameFromCoordinates(
            location.latitude,
            location.longitude
          )

          if (targetKind === "intel") {
            setIntelLocationName(locationName)
            nextStatus = `Intel for ${locationName}`
          } else {
            setWeatherLocationName(locationName)
            nextStatus = `Weather for ${locationName}`
          }
        } catch {
          const fallbackName = formatCoordinateLocation(
            location.latitude,
            location.longitude
          )

          if (targetKind === "intel") {
            setIntelLocationName(fallbackName)
            nextStatus = "Intel for pinned spot"
          } else {
            setWeatherLocationName(fallbackName)
            nextStatus = "Weather for pinned spot"
          }
        }
      }

      setWeatherValues(values)
      setWeatherStatus(nextStatus)
      return values
    } catch {
      setWeatherStatus("Weather unavailable")
      throw new Error("Weather unavailable")
    }
  }

  async function openWeatherPanel() {
    if (weatherOpen) {
      closeWeatherPanel()
      return
    }

    setWeatherOpen(true)
    closeIntelPanel()
    closeFieldNote()
    setLayersOpen(false)
    await loadWeatherValues("Finding current weather...").catch(() => undefined)
  }

  async function openIntelPanel() {
    if (intelOpen) {
      closeIntelPanel()
      return
    }

    setIntelOpen(true)
    closeWeatherPanel()
    closeFieldNote()
    setLayersOpen(false)
    setActiveTool("browse")

    if (!weatherValues["weather.pressureTrend"]) {
      await loadWeatherValues(
        "Building intel...",
        undefined,
        "Current location intel"
      ).catch(() => undefined)
    }
  }

  function closeIntelPanel() {
    setIntelOpen(false)
    setIntelPoint(null)
    setIntelLocationName("")
  }

  function closeWeatherPanel() {
    setWeatherOpen(false)
    setWeatherPoint(null)
    setWeatherLocationName("")
  }

  async function dropIntelPoint(point: LocationPoint) {
    setIntelPoint(point)
    setIntelOpen(true)
    closeWeatherPanel()
    closeFieldNote()
    setLayersOpen(false)
    setActiveTool("browse")
    setIntelLocationName("Pinned spot")

    await loadWeatherValues(
      "Building intel for pin...",
      point,
      "Intel for pinned spot",
      "intel"
    ).catch(() => undefined)
  }

  async function dropWeatherPoint(point: LocationPoint) {
    setWeatherPoint(point)
    setWeatherOpen(true)
    closeIntelPanel()
    closeFieldNote()
    setLayersOpen(false)
    setActiveTool("browse")
    setWeatherLocationName("Pinned spot")

    await loadWeatherValues(
      "Loading weather for pin...",
      point,
      "Weather for pinned spot",
      "weather"
    ).catch(() => undefined)
  }

  async function loadFieldNoteConditions(point: LocationPoint) {
    setFieldNoteConditionStatus("Loading current conditions...")

    try {
      const values = await getAutomaticEnvironmentData(
        point.latitude,
        point.longitude,
        pressureTrendHours
      )

      setFieldNoteConditionValues(values)
      setFieldNoteConditionStatus("Current conditions")
    } catch {
      setFieldNoteConditionValues({})
      setFieldNoteConditionStatus("Current conditions unavailable")
    }
  }

  function closeFieldNote() {
    setFieldNoteOpen(false)
    setFieldNotePoint(null)
    setFieldNoteTitle("Field Note / Pin")
    setFieldNoteText("")
    setFieldNotePhotos([])
    setFieldNoteConditionValues({})
    setFieldNoteConditionStatus("")
    setEditingMapItemId(null)
  }

  function toggleFieldNote() {
    if (fieldNoteOpen) {
      closeFieldNote()
      return
    }

    setFieldNoteOpen(true)
    setFieldNotePoint(mapCenter)
    closeIntelPanel()
    closeWeatherPanel()
    setLayersOpen(false)
    void loadFieldNoteConditions(mapCenter)
  }

  function editMapItem(item: SavedMapItem) {
    setEditingMapItemId(item.id)
    setFieldNoteOpen(true)
    setFieldNotePoint({
      latitude: item.latitude,
      longitude: item.longitude,
    })
    setFieldNoteTitle(item.title || "Field Note / Pin")
    setFieldNoteText(item.note || "")
    setFieldNotePhotos(item.photoDataUrls ?? [])
    setFieldNoteConditionValues({})
    setFieldNoteConditionStatus("")
    closeIntelPanel()
    closeWeatherPanel()
    setLayersOpen(false)
    setActiveTool("browse")
    void loadFieldNoteConditions({
      latitude: item.latitude,
      longitude: item.longitude,
    })
  }

  function toggleLayers() {
    setLayersOpen((open) => !open)
    closeIntelPanel()
    closeWeatherPanel()
    closeFieldNote()
  }

  function addFieldNotePhoto(photo: string) {
    setFieldNotePhotos((current) => [...current, photo].slice(0, 8))
  }

  function removeFieldNotePhoto(photoIndex: number) {
    setFieldNotePhotos((current) =>
      current.filter((_, index) => index !== photoIndex)
    )
  }

  function startDictation() {
    const Recognition = getBrowserSpeechRecognition()
    if (!Recognition) {
      setFieldNoteText((current) =>
        current || "Dictation is not available in this browser."
      )
      return
    }

    const recognition = new Recognition()
    recognition.lang = "en-AU"
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const spokenText = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim()

      if (spokenText) {
        setFieldNoteText((current) =>
          current ? `${current} ${spokenText}` : spokenText
        )
      }
    }
    recognition.onerror = () => {
      setFieldNoteText((current) =>
        current || "Dictation could not start on this device."
      )
    }
    recognition.start()
  }

  function updateMapItems(
    update: SavedMapItem[] | ((current: SavedMapItem[]) => SavedMapItem[])
  ) {
    setMapItems((current) => {
      const nextItems = typeof update === "function" ? update(current) : update
      try {
        saveMapItems(nextItems)
      } catch (error) {
        console.warn("Map pins could not be saved locally.", error)
      }
      return nextItems
    })
  }

  function saveFieldNote() {
    const title = fieldNoteTitle.trim() || "Field Note / Pin"
    const point = fieldNotePoint ?? mapCenter
    const createdAt = new Date().toISOString()
    const savedItem: SavedMapItem = {
      id: editingMapItemId ?? nextMapItemId.current++,
      type: "field-note-waypoint",
      title,
      note: fieldNoteText.trim(),
      category: "Field Note / Pin",
      latitude: point.latitude,
      longitude: point.longitude,
      createdAt,
      photoDataUrls: fieldNotePhotos.length > 0 ? fieldNotePhotos : undefined,
      conditions: noteConditionRows,
    }

    updateMapItems((current) =>
      editingMapItemId
        ? current.map((item) =>
            item.id === editingMapItemId
              ? { ...savedItem, createdAt: item.createdAt }
              : item
          )
        : [...current, savedItem]
    )
    closeFieldNote()
  }

  function deleteMapItem(itemId: number) {
    updateMapItems((current) => current.filter((item) => item.id !== itemId))
  }

  function toggleMapStyle(style: MapStyle) {
    setMapStyle(style)
    setLayersOpen(false)
  }

  function selectSearchResult(result: MapSearchResult) {
    setSelectedSearchResult(result)
    setMapSearchQuery(result.label)
    setSearchFocused(false)
    setSearchRequest((current) => current + 1)
    closeWeatherPanel()
    closeIntelPanel()
    setLayersOpen(false)
    closeFieldNote()
    setActiveTool("browse")
  }

  function clearSearch() {
    setMapSearchQuery("")
    setPlaceSearchResults([])
    setSelectedSearchResult(null)
    setSearchFocused(false)
  }

  function closeMapOverlays() {
    closeWeatherPanel()
    closeIntelPanel()
    setLayersOpen(false)
    setSearchFocused(false)
  }

  function handleCatchPopupTap(catchId: number, eventTime: number) {
    const now = eventTime
    const lastTap = lastCatchPopupTap.current

    if (lastTap?.id === catchId && now - lastTap.time < 420) {
      lastCatchPopupTap.current = null
      window.setTimeout(() => onOpenCatchDetail(catchId), 120)
      return
    }

    lastCatchPopupTap.current = { id: catchId, time: now }
  }

  function handleMapItemPopupTap(itemId: number, eventTime: number) {
    const lastTap = lastMapItemPopupTap.current

    if (lastTap?.id === itemId && eventTime - lastTap.time < 420) {
      lastMapItemPopupTap.current = null
      window.setTimeout(() => onOpenFieldNoteDetail(itemId), 120)
      return
    }

    lastMapItemPopupTap.current = { id: itemId, time: eventTime }
  }

  return (
    <main
      className="phone-map-screen"
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        window.getSelection()?.removeAllRanges()
      }}
    >
      <MapContainer
        center={[-37.25, 144.9]}
        zoom={7}
        className="home-map"
        zoomControl={false}
      >
        <TileLayer
          key={mapStyle}
          attribution={selectedTiles.attribution}
          url={selectedTiles.url}
        />

        <MapViewport
          currentLocation={currentLocation}
          points={points}
          recenterRequest={recenterRequest}
          searchRequest={searchRequest}
          searchTarget={selectedSearchResult}
        />
        <MapToolEvents
          activeTool={activeTool}
          fieldNoteOpen={fieldNoteOpen}
          intelOpen={intelOpen}
          weatherOpen={weatherOpen}
          onCenterChange={setMapCenter}
          onFieldNotePoint={(point) => {
            setFieldNotePoint(point)
            void loadFieldNoteConditions(point)
          }}
          onIntelPoint={(point) => void dropIntelPoint(point)}
          onMapTap={closeMapOverlays}
          onMeasurePoint={(point) => setMeasurePoints((current) => [...current, point])}
          onWeatherPoint={(point) => void dropWeatherPoint(point)}
        />
        {currentLocation && (
          <Marker icon={currentLocationIcon} position={currentLocation}>
            <Popup autoPan={false} closeOnClick>You are here</Popup>
          </Marker>
        )}
        {(homeMapDisplay.catchPins ?? true) && mappedCatches.map((fish) => {
          const mainPhoto = getCatchPhotos(fish)[0]

          return (
            <Marker
              key={fish.id}
              icon={fishMarkerIcon}
              position={[fish.latitude!, fish.longitude!]}
            >
              <Popup
                autoPan={false}
                className="map-catch-popup"
                closeOnClick
                maxWidth={220}
              >
                <button
                  className="map-catch-popup-card"
                  onClick={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    window.setTimeout(() => onOpenCatchDetail(fish.id), 120)
                  }}
                  onTouchEnd={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    handleCatchPopupTap(fish.id, event.timeStamp)
                  }}
                  type="button"
                >
                  {mainPhoto ? (
                    <img
                      src={mainPhoto}
                      alt={fish.species || "Recorded catch"}
                    />
                  ) : (
                    <span className="map-catch-popup-placeholder">No photo</span>
                  )}
                  <strong>{fish.species || "Unknown species"}</strong>
                  <span>{formatLength(fish.length, lengthUnit)} · {formatWeight(fish.weight, weightUnit)}</span>
                  <span>{getCatchDisplayLocation(fish)}</span>
                  <span>{new Date(fish.dateTime).toLocaleString()}</span>
                </button>
              </Popup>
            </Marker>
          )
        })}
        {visibleMapMarkers.map((item) => (
          <Marker
            key={item.id}
            icon={getMapItemIcon(item, homeMapDisplay.markerNameLabels ?? true)}
            position={[item.latitude, item.longitude]}
          >
            <Popup autoPan={false} closeOnClick className="map-item-popup" maxWidth={190}>
              <article
                className="map-item-popup-card"
                onClick={(event) => event.stopPropagation()}
                onDoubleClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  window.setTimeout(() => onOpenFieldNoteDetail(item.id), 120)
                }}
                onTouchEnd={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  handleMapItemPopupTap(item.id, event.timeStamp)
                }}
              >
                <header>
                  <span>{getMapItemTypeLabel(item)}</span>
                  <strong>{item.title}</strong>
                </header>
                {item.note && <p>{item.note}</p>}
                {item.photoDataUrls?.[0] && (
                  <img
                    src={item.photoDataUrls[0]}
                    alt={item.title}
                    className="map-popup-photo"
                  />
                )}
                {item.photoDataUrls && item.photoDataUrls.length > 1 && (
                  <span className="map-popup-photo-count">
                    {item.photoDataUrls.length} photos
                  </span>
                )}
                <footer>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      editMapItem(item)
                    }}
                    onTouchEnd={(event) => event.stopPropagation()}
                  >
                    Edit
                  </button>
                  <button
                    className="danger-popup-button"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      deleteMapItem(item.id)
                    }}
                    onTouchEnd={(event) => event.stopPropagation()}
                  >
                    Delete
                  </button>
                </footer>
              </article>
            </Popup>
          </Marker>
        ))}
        {fieldNoteOpen && fieldNotePoint && (
          <Marker
            icon={pendingFieldNoteIcon}
            position={[fieldNotePoint.latitude, fieldNotePoint.longitude]}
          >
            <Popup autoPan={false} closeOnClick>
              <strong>{fieldNoteTitle || "Unsaved Field Note / Pin"}</strong>
              <br />
              {fieldNoteText || "Tap Save Pin to keep this note."}
            </Popup>
          </Marker>
        )}
        {intelOpen && intelPoint && (
          <Marker
            icon={intelMarkerIcon}
            position={[intelPoint.latitude, intelPoint.longitude]}
          >
            <Popup autoPan={false} closeOnClick>
              <strong>Intel target</strong>
              <br />
              {intelLocationName || "Pinned spot"}
            </Popup>
          </Marker>
        )}
        {weatherOpen && weatherPoint && (
          <Marker
            icon={weatherMarkerIcon}
            position={[weatherPoint.latitude, weatherPoint.longitude]}
          >
            <Popup autoPan={false} closeOnClick>
              <strong>Weather target</strong>
              <br />
              {weatherLocationName || "Pinned spot"}
            </Popup>
          </Marker>
        )}
        {selectedSearchResult && (homeMapDisplay.searchSelectionMarker ?? true) && (
          <Marker
            icon={searchMarkerIcon}
            position={[
              selectedSearchResult.latitude,
              selectedSearchResult.longitude,
            ]}
          >
            <Popup autoPan={false} closeOnClick className="map-item-popup" maxWidth={210}>
              <strong>{selectedSearchResult.label}</strong>
              <br />
              {selectedSearchResult.detail}
            </Popup>
          </Marker>
        )}
        {measurePoints.length > 0 && (
          <>
            <Polyline
              positions={measurePoints.map((point) => [point.latitude, point.longitude])}
              pathOptions={{ color: "#0797a6", weight: 4 }}
            />
            {measurePoints.map((point, index) => (
              <CircleMarker
                key={`${point.latitude}:${point.longitude}:${index}`}
                center={[point.latitude, point.longitude]}
                pathOptions={{ color: "#ffffff", fillColor: "#0797a6", fillOpacity: 1, weight: 2 }}
                radius={5}
              />
            ))}
          </>
        )}
      </MapContainer>

      {summaryEnabled && (
        <section className="map-top-panel" aria-label="Current fishing summary">
          {(summaryCopyEnabled || searchEnabled) && (
            <div className="map-top-main">
              {summaryCopyEnabled && (
                <div className="map-top-copy">
                  {(homeSummary.location ?? true) && <h1>{locationTitle}</h1>}
                  {(homeSummary.gpsStatus ?? true) && (
                    <span className="gps-pill">{locationStatus}</span>
                  )}
                </div>
              )}
              {searchEnabled && (
                <div className="map-search-field">
                  <span>Search</span>
                  <div className="map-search-input-wrap">
                    <input
                      aria-label="Search map"
                      placeholder="Search map..."
                      value={mapSearchQuery}
                      onBlur={() => window.setTimeout(() => setSearchFocused(false), 140)}
                      onChange={(event) => {
                        setMapSearchQuery(event.target.value)
                        setSelectedSearchResult(null)
                      }}
                      onFocus={() => setSearchFocused(true)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && visibleSearchResults[0]) {
                          selectSearchResult(visibleSearchResults[0])
                        }
                      }}
                    />
                    {mapSearchQuery !== "" && (
                      <button
                        aria-label="Clear map search"
                        className="map-search-clear"
                        onClick={clearSearch}
                        onMouseDown={(event) => event.preventDefault()}
                        type="button"
                      >
                        x
                      </button>
                    )}
                  </div>
                  {showSearchResults && (
                    <div className="map-search-results">
                      {visibleSearchResults.map((result) => (
                        <button
                          key={result.id}
                          type="button"
                          onClick={() => selectSearchResult(result)}
                        >
                          <small>{result.kind}</small>
                          <strong>{result.label}</strong>
                          <span>{result.detail}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {showSummaryMetrics && (
            <div
              className="map-metrics"
              style={{
                gridTemplateColumns: `repeat(${summaryMetrics.length + ((homeSummary.mapButton ?? true) ? 1 : 0)}, minmax(0, 1fr))`,
              }}
            >
              {summaryMetrics.map((metric) => (
                <div key={metric.key}>
                  <strong>{metric.value}</strong>
                  <span>{metric.label}</span>
                </div>
              ))}
              {(homeSummary.mapButton ?? true) && (
                <button type="button" onClick={onOpenCatchMap}>
                  Map
                </button>
              )}
            </div>
          )}
        </section>
      )}

      <div className="home-side-tools home-left-tools" aria-label="Quick actions">
        <button
          className="home-tool-button record-map-button"
          type="button"
          onClick={onRecordCatch}
          aria-label="Record catch"
        >
          <span>+</span>
          Record Catch
        </button>
        {(homeMapControls.fieldNote ?? true) && (
          <button
            className={`home-tool-button${fieldNoteOpen ? " active" : ""}`}
            type="button"
            onClick={toggleFieldNote}
          >
            <span>FN</span>
            Field Note / Pin
          </button>
        )}
        {(homeMapControls.recenter ?? true) && (
          <button
            type="button"
            className="home-tool-button"
            disabled={!currentLocation}
            onClick={() => setRecenterRequest((current) => current + 1)}
          >
            <span>GPS</span>
            Recenter
          </button>
        )}
      </div>

      <div className="home-side-tools home-right-tools" aria-label="Map tools">
        {(homeMapControls.weather ?? true) && (
          <button
            className={`home-tool-button${weatherOpen ? " active" : ""}`}
            type="button"
            onClick={() => void openWeatherPanel()}
          >
            <span className="weather-button-icon" aria-hidden="true"></span>
            Weather
          </button>
        )}
        {(homeMapControls.intel ?? true) && (
          <button
            className={`home-tool-button${intelOpen ? " active" : ""}`}
            type="button"
            onClick={() => void openIntelPanel()}
          >
            <span>IN</span>
            Intel
          </button>
        )}
        {(homeMapControls.measure ?? true) && (
          <button
            className={`home-tool-button${activeTool === "measure" ? " active" : ""}`}
            type="button"
            onClick={() => {
              if (activeTool === "measure") {
                setActiveTool("browse")
                return
              }

              closeIntelPanel()
              closeWeatherPanel()
              closeFieldNote()
              setLayersOpen(false)
              setActiveTool("measure")
            }}
          >
            <span>MS</span>
            Measure
          </button>
        )}
        {(homeMapControls.layers ?? true) && (
          <button
            className={`home-tool-button${layersOpen ? " active" : ""}`}
            type="button"
            onClick={toggleLayers}
          >
            <span>LY</span>
            Layers
          </button>
        )}
      </div>

      {layersOpen && (homeMapControls.layers ?? true) && (
        <section className="home-layer-picker" aria-label="Map layers">
          {([
            ["standard", "Standard"],
            ["topo", "Topo"],
            ["satellite", "Satellite"],
          ] as [MapStyle, string][]).map(([style, label]) => (
            <button
              key={style}
              className={mapStyle === style ? "active" : ""}
              type="button"
              onClick={() => toggleMapStyle(style)}
            >
              {label}
            </button>
          ))}
        </section>
      )}

      {weatherOpen && (homeMapControls.weather ?? true) && (
        <section className="map-tool-card home-map-tool-card map-weather-card">
          <header>
            <h2>{weatherStatus || "Weather"}</h2>
            <button type="button" onClick={closeWeatherPanel}>Close</button>
          </header>
          <p className="page-note">
            Hold the map to check weather at a pinned spot.
          </p>
          <div className="map-weather-grid">
            {visibleWeather.map((condition) => (
              <p key={condition.key}>
                <strong>{condition.label}</strong>
                <span>{weatherValues[condition.key] || "-"}</span>
              </p>
            ))}
          </div>
        </section>
      )}

      {intelOpen && (homeMapControls.intel ?? true) && (
        <section className="map-tool-card home-map-tool-card intel-map-card">
          <header>
            <h2>Murray Cod Intel</h2>
            <button type="button" onClick={closeIntelPanel}>Close</button>
          </header>
          <p className="page-note">
            {weatherStatus || "Hold the map to drop an intel pin."}
          </p>
          <div className="intel-score">
            <strong>{intel.score}</strong>
            <span>{intel.label}</span>
          </div>
          <p className="page-note">{weatherStatus === "Weather unavailable" ? "Intel unavailable until weather is connected." : intel.summary}</p>
          <div className="map-weather-grid">
            {intel.rows.map(([label, value]) => (
              <p key={label}>
                <strong>{label}</strong>
                <span>{value}</span>
              </p>
            ))}
          </div>
        </section>
      )}

      {fieldNoteOpen && (homeMapControls.fieldNote ?? true) && (
        <section className="map-tool-card home-map-tool-card field-note-sheet">
          <header className="field-note-header">
            <div>
              <p>{editingMapItemId ? "Edit Field Note / Pin" : "Field Note / Pin"}</p>
              <h2>
                {editingMapItemId ? "Editing saved pin" : "Logged now"} · {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </h2>
            </div>
            <span className="field-note-gps">{fieldNotePoint ? "GPS" : "GPS -"}</span>
            <button type="button" onClick={closeFieldNote}>Close</button>
          </header>
          <label>
            Title
            <input
              value={fieldNoteTitle}
              onChange={(event) => setFieldNoteTitle(event.target.value)}
            />
          </label>
          <div className="field-note-dictation-row">
            <label>
              Note
              <textarea
                value={fieldNoteText}
                onChange={(event) => setFieldNoteText(event.target.value)}
                placeholder="What did you notice?"
              />
            </label>
            <button type="button" onClick={startDictation}>
              Dictate
            </button>
          </div>
          <div className="field-photo-strip">
            <PhotoAddMenu onPhotoAdd={addFieldNotePhoto} />
            <span>{fieldNotePhotos.length} / 8</span>
            {fieldNotePhotos.map((photo, index) => (
              <div key={`${photo.slice(0, 32)}-${index}`} className="field-photo-thumb">
                <img src={photo} alt={`Field note ${index + 1}`} />
                <button type="button" onClick={() => removeFieldNotePhoto(index)}>
                  -
                </button>
              </div>
            ))}
          </div>
          <details className="captured-note-conditions">
            <summary>
              <strong>Current Conditions</strong>
              {fieldNoteConditionStatus && <span>{fieldNoteConditionStatus}</span>}
            </summary>
            <div>
              {noteConditionRows.length > 0 ? noteConditionRows.map((condition) => (
                <p key={condition.label}>
                  <strong>{condition.value}</strong>
                  <span>{condition.label}</span>
                </p>
              )) : (
                <p>
                  <strong>-</strong>
                  <span>No conditions enabled</span>
                </p>
              )}
            </div>
          </details>
          <button className="primary-button field-note-save" type="button" onClick={saveFieldNote}>
            {editingMapItemId ? "Save Changes" : "Save Pin"}
          </button>
        </section>
      )}

      {activeTool === "measure" && (homeMapControls.measure ?? true) && (
        <section className="measure-readout home-measure-readout measure-profile-card">
          <header>
            <button type="button" onClick={() => setMeasurePoints((current) => current.slice(0, -1))}>
              Back
            </button>
            <span>Terrain</span>
            <strong>{formatDistance(measureDistance)}</strong>
            <button
              type="button"
              onClick={() => {
                setMeasurePoints([])
                setActiveTool("browse")
              }}
            >
              Close
            </button>
          </header>
          <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-label="Estimated elevation profile">
            <polygon points={`0,60 ${elevationStats.points} 100,60`} />
            <polyline points={elevationStats.points} />
          </svg>
          <p>
            ↑ {elevationStats.gain} m ↓ {elevationStats.loss} m max {elevationStats.max} m min {elevationStats.min} m
          </p>
          <button
            className="primary-button"
            type="button"
            onClick={() => setActiveTool("browse")}
          >
            Finish
          </button>
        </section>
      )}

      <nav className="bottom-tabs" aria-label="Main navigation">
        <button type="button" onClick={onOpenFieldNotes}>
          <span>Notes</span>
        </button>
        <button type="button" onClick={onOpenCatches}>
          <span>My Catches</span>
        </button>
        <button type="button" onClick={onOpenStats}>
          <span>Stats</span>
        </button>
        <button type="button" onClick={onOpenRecords}>
          <span>Records</span>
        </button>
        <button type="button" onClick={onOpenSettings}>
          <span>Settings</span>
        </button>
      </nav>
    </main>
  )
}

export default Home
