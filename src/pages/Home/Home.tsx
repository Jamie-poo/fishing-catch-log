import { useEffect, useMemo, useRef, useState } from "react"
import * as maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { getAutomaticEnvironmentData } from "../../data/environmentData"
import {
  getLocationNameFromCoordinates,
} from "../../data/location"
import { mapWeatherOptions } from "../../data/mapWeather"
import { useCatches } from "../../data/useCatches"
import { useCatchLogSettings } from "../../data/useCatchLogSettings"
import PhotoAddMenu from "../../components/PhotoAddMenu"

const mapTiles = {
  standard: {
    attribution: "&copy; OpenStreetMap contributors",
    url: "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
  satellite: {
    attribution: "Tiles &copy; Esri",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  },
  topo: {
    attribution: "&copy; OpenTopoMap contributors",
    url: "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
  },
}

const terrainTiles = {
  url: "https://tiles.mapterhorn.com/tilejson.json",
}

type HomeProps = {
  onOpenCatches: () => void
  onOpenStats: () => void
  onOpenCatchMap: () => void
  onOpenRecords: () => void
  onOpenSettings: () => void
  onRecordCatch: () => void
}

type LocationPoint = {
  latitude: number
  longitude: number
}

type SavedMapItem = LocationPoint & {
  id: number
  type: "waypoint" | "field-note"
  title: string
  note: string
  category?: string
  createdAt: string
  photoDataUrls?: string[]
}

type MapStyle = keyof typeof mapTiles

type MapTool = "browse" | "waypoint" | "measure"

type HomeMapProps = {
  activeTool: MapTool
  currentLocation: [number, number] | null
  deleteMapItem: (itemId: number) => void
  fieldNoteOpen: boolean
  fieldNotePoint: LocationPoint | null
  fieldNoteText: string
  fieldNoteTitle: string
  is3d: boolean
  mapItems: SavedMapItem[]
  mappedCatches: ReturnType<typeof useCatches>["catches"]
  mapStyle: MapStyle
  measurePoints: LocationPoint[]
  onFieldNotePoint: (point: LocationPoint) => void
  onCenterChange: (point: LocationPoint) => void
  onMeasurePoint: (point: LocationPoint) => void
  onWaypointPoint: (point: LocationPoint) => void
  points: [number, number][]
  recenterRequest: number
  waypointCategory: string
  waypointNote: string
  waypointOpen: boolean
  waypointPoint: LocationPoint | null
  waypointTitle: string
}

function loadMapItems() {
  const saved = localStorage.getItem("catch-map-items")
  if (!saved) return []

  try {
    const parsed = JSON.parse(saved)
    return Array.isArray(parsed) ? (parsed as SavedMapItem[]) : []
  } catch {
    return []
  }
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

function distanceBetween(start: LocationPoint, end: LocationPoint) {
  const earthRadius = 6_371_000
  const startLat = (start.latitude * Math.PI) / 180
  const endLat = (end.latitude * Math.PI) / 180
  const deltaLat = ((end.latitude - start.latitude) * Math.PI) / 180
  const deltaLng = ((end.longitude - start.longitude) * Math.PI) / 180
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
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

function buildMapStyle(style: MapStyle, is3d: boolean) {
  const selectedTiles = mapTiles[style]

  return {
    version: 8,
    sources: {
      base: {
        type: "raster",
        tiles: [selectedTiles.url],
        tileSize: 256,
        attribution: selectedTiles.attribution,
      },
      terrainSource: {
        type: "raster-dem",
        url: terrainTiles.url,
      },
      hillshadeSource: {
        type: "raster-dem",
        url: terrainTiles.url,
      },
    },
    layers: [
      {
        id: "base",
        type: "raster",
        source: "base",
      },
      ...(is3d
        ? [
            {
              id: "terrain-shade",
              type: "hillshade",
              source: "hillshadeSource",
              paint: {
                "hillshade-exaggeration": 0.34,
                "hillshade-shadow-color": "rgba(12, 18, 16, 0.36)",
                "hillshade-highlight-color": "rgba(255, 255, 255, 0.3)",
              },
            },
          ]
        : []),
    ],
    terrain: is3d ? { source: "terrainSource", exaggeration: 1.35 } : undefined,
    sky: is3d ? {} : undefined,
  } as maplibregl.StyleSpecification
}

function createMarkerElement(className: string, label?: string) {
  const marker = document.createElement("div")
  marker.className = className

  if (label !== undefined) {
    const markerLabel = document.createElement("span")
    markerLabel.textContent = label
    marker.appendChild(markerLabel)
  }

  return marker
}

function createPopupContent({
  deleteLabel,
  image,
  lines,
  onDelete,
  title,
}: {
  deleteLabel?: string
  image?: string
  lines: string[]
  onDelete?: () => void
  title: string
}) {
  const content = document.createElement("div")
  const heading = document.createElement("strong")
  heading.textContent = title
  content.appendChild(heading)

  lines.filter(Boolean).forEach((line) => {
    content.appendChild(document.createElement("br"))
    content.appendChild(document.createTextNode(line))
  })

  if (image) {
    const photo = document.createElement("img")
    photo.src = image
    photo.alt = title
    photo.className = "map-popup-photo"
    content.appendChild(document.createElement("br"))
    content.appendChild(photo)
  }

  if (onDelete) {
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = deleteLabel || "Delete"
    button.addEventListener("click", onDelete)
    content.appendChild(document.createElement("br"))
    content.appendChild(button)
  }

  return content
}

function syncMeasureLayer(map: maplibregl.Map, measurePoints: LocationPoint[]) {
  if (!map.isStyleLoaded()) {
    map.once("style.load", () => syncMeasureLayer(map, measurePoints))
    return
  }

  const lineData = {
    type: "FeatureCollection",
    features:
      measurePoints.length > 1
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: measurePoints.map((point) => [
                  point.longitude,
                  point.latitude,
                ]),
              },
            },
          ]
        : [],
  } as Parameters<maplibregl.GeoJSONSource["setData"]>[0]
  const pointData = {
    type: "FeatureCollection",
    features: measurePoints.map((point) => ({
      type: "Feature",
      properties: {},
      geometry: {
        type: "Point",
        coordinates: [point.longitude, point.latitude],
      },
    })),
  } as Parameters<maplibregl.GeoJSONSource["setData"]>[0]

  const existingLine = map.getSource("measure-line") as
    | maplibregl.GeoJSONSource
    | undefined
  const existingPoints = map.getSource("measure-points") as
    | maplibregl.GeoJSONSource
    | undefined

  if (existingLine) {
    existingLine.setData(lineData)
  } else {
    map.addSource("measure-line", { type: "geojson", data: lineData })
    map.addLayer({
      id: "measure-line",
      type: "line",
      source: "measure-line",
      paint: {
        "line-color": "#0797a6",
        "line-width": 4,
      },
    })
  }

  if (existingPoints) {
    existingPoints.setData(pointData)
  } else {
    map.addSource("measure-points", { type: "geojson", data: pointData })
    map.addLayer({
      id: "measure-points",
      type: "circle",
      source: "measure-points",
      paint: {
        "circle-color": "#0797a6",
        "circle-radius": 5,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    })
  }
}

function HomeMap({
  activeTool,
  currentLocation,
  deleteMapItem,
  fieldNoteOpen,
  fieldNotePoint,
  fieldNoteText,
  fieldNoteTitle,
  is3d,
  mapItems,
  mappedCatches,
  mapStyle,
  measurePoints,
  onFieldNotePoint,
  onCenterChange,
  onMeasurePoint,
  onWaypointPoint,
  points,
  recenterRequest,
  waypointCategory,
  waypointNote,
  waypointOpen,
  waypointPoint,
  waypointTitle,
}: HomeMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRefs = useRef<maplibregl.Marker[]>([])
  const hasSetInitialView = useRef(false)
  const mapStateRef = useRef({
    activeTool,
    fieldNoteOpen,
    onCenterChange,
    onFieldNotePoint,
    onMeasurePoint,
    onWaypointPoint,
  })

  useEffect(() => {
    mapStateRef.current = {
      activeTool,
      fieldNoteOpen,
      onCenterChange,
      onFieldNotePoint,
      onMeasurePoint,
      onWaypointPoint,
    }
  }, [
    activeTool,
    fieldNoteOpen,
    onCenterChange,
    onFieldNotePoint,
    onMeasurePoint,
    onWaypointPoint,
  ])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return
    }

    const map = new maplibregl.Map({
      attributionControl: false,
      center: [144.9, -37.25],
      container: mapContainerRef.current,
      maxPitch: 85,
      pitch: 0,
      bearing: 0,
      style: buildMapStyle("satellite", false),
      zoom: 7,
    })

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right"
    )
    map.dragRotate.enable()
    map.touchZoomRotate.enableRotation()
    mapRef.current = map

    map.on("click", (event: maplibregl.MapMouseEvent) => {
      const point = {
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      }
      const {
        activeTool: currentTool,
        fieldNoteOpen: currentFieldNoteOpen,
        onFieldNotePoint: setFieldNotePoint,
        onMeasurePoint: addMeasurePoint,
        onWaypointPoint: setWaypointPoint,
      } = mapStateRef.current

      if (currentTool === "measure") {
        addMeasurePoint(point)
        return
      }

      if (currentTool === "waypoint") {
        setWaypointPoint(point)
        return
      }

      if (currentFieldNoteOpen) {
        setFieldNotePoint(point)
      }
    })

    map.on("moveend", () => {
      const center = map.getCenter()
      mapStateRef.current.onCenterChange({
        latitude: center.lat,
        longitude: center.lng,
      })
    })

    return () => {
      markerRefs.current.forEach((marker) => marker.remove())
      markerRefs.current = []
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current

    if (!map) {
      return
    }

    map.setStyle(buildMapStyle(mapStyle, is3d), { diff: false })
    map.easeTo({
      bearing: is3d ? -24 : 0,
      duration: 700,
      pitch: is3d ? 64 : 0,
    })
  }, [is3d, mapStyle])

  useEffect(() => {
    const map = mapRef.current

    if (!map) {
      return
    }

    syncMeasureLayer(map, measurePoints)
  }, [is3d, mapStyle, measurePoints])

  useEffect(() => {
    const map = mapRef.current

    if (!map) {
      return
    }

    markerRefs.current.forEach((marker) => marker.remove())
    markerRefs.current = []

    const addMarker = (marker: maplibregl.Marker) => {
      markerRefs.current.push(marker)
      marker.addTo(map)
    }

    if (currentLocation) {
      addMarker(
        new maplibregl.Marker({
          element: createMarkerElement("current-location-marker", ""),
          pitchAlignment: "map",
        })
          .setLngLat([currentLocation[1], currentLocation[0]])
          .setPopup(
            new maplibregl.Popup().setDOMContent(
              createPopupContent({ lines: [], title: "You are here" })
            )
          )
      )
    }

    mappedCatches.forEach((fish) => {
      addMarker(
        new maplibregl.Marker({ color: "#1a8cff" })
          .setLngLat([fish.longitude!, fish.latitude!])
          .setPopup(
            new maplibregl.Popup().setDOMContent(
              createPopupContent({
                lines: [fish.locationName || "Location saved"],
                title: fish.species || "Unknown species",
              })
            )
          )
      )
    })

    mapItems.forEach((item) => {
      addMarker(
        new maplibregl.Marker({
          element: createMarkerElement(
            `map-tool-marker ${item.type === "waypoint" ? "waypoint-marker" : "field-note-marker"}`,
            item.type === "waypoint" ? "W" : "N"
          ),
        })
          .setLngLat([item.longitude, item.latitude])
          .setPopup(
            new maplibregl.Popup().setDOMContent(
              createPopupContent({
                image: item.photoDataUrls?.[0],
                lines: [
                  item.type === "waypoint" && item.category
                    ? `${item.category} waypoint`
                    : "Field note",
                  item.note,
                ],
                onDelete: () => deleteMapItem(item.id),
                title: item.title,
              })
            )
          )
      )
    })

    if (fieldNoteOpen && fieldNotePoint) {
      addMarker(
        new maplibregl.Marker({
          element: createMarkerElement("map-tool-marker pending-field-note-marker", "N"),
        })
          .setLngLat([fieldNotePoint.longitude, fieldNotePoint.latitude])
          .setPopup(
            new maplibregl.Popup().setDOMContent(
              createPopupContent({
                lines: [fieldNoteText || "Tap Save Field Note to keep this note."],
                title: fieldNoteTitle || "Unsaved field note",
              })
            )
          )
      )
    }

    if (waypointOpen && waypointPoint) {
      addMarker(
        new maplibregl.Marker({
          element: createMarkerElement("map-tool-marker pending-waypoint-marker", "+"),
        })
          .setLngLat([waypointPoint.longitude, waypointPoint.latitude])
          .setPopup(
            new maplibregl.Popup().setDOMContent(
              createPopupContent({
                lines: [
                  `${waypointCategory || "Spot"} waypoint`,
                  waypointNote,
                ],
                title: waypointTitle || "Unsaved waypoint",
              })
            )
          )
      )
    }
  }, [
    currentLocation,
    deleteMapItem,
    fieldNoteOpen,
    fieldNotePoint,
    fieldNoteText,
    fieldNoteTitle,
    mapItems,
    mappedCatches,
    waypointCategory,
    waypointNote,
    waypointOpen,
    waypointPoint,
    waypointTitle,
  ])

  useEffect(() => {
    const map = mapRef.current

    if (!map || hasSetInitialView.current || points.length === 0) {
      return
    }

    const bounds = new maplibregl.LngLatBounds()
    points.forEach(([latitude, longitude]) => bounds.extend([longitude, latitude]))
    hasSetInitialView.current = true
    map.fitBounds(bounds, { maxZoom: 13, padding: 44 })
  }, [points])

  useEffect(() => {
    const map = mapRef.current

    if (!map || !currentLocation || recenterRequest === 0) {
      return
    }

    map.flyTo({
      center: [currentLocation[1], currentLocation[0]],
      essential: true,
      pitch: is3d ? 64 : 0,
      zoom: Math.max(map.getZoom(), 15),
    })
  }, [currentLocation, is3d, recenterRequest])

  return <div ref={mapContainerRef} className="home-map" />
}

function Home({
  onOpenCatches,
  onOpenStats,
  onOpenCatchMap,
  onOpenRecords,
  onOpenSettings,
  onRecordCatch,
}: HomeProps) {
  const { catches } = useCatches()
  const {
    homeMapControls,
    homeSummary,
    mapWeatherConditions,
    pressureTrendHours,
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
  const [recenterRequest, setRecenterRequest] = useState(0)
  const [mapCenter, setMapCenter] = useState<LocationPoint>({
    latitude: -37.25,
    longitude: 144.9,
  })
  const [mapStyle, setMapStyle] = useState<MapStyle>("satellite")
  const [layersOpen, setLayersOpen] = useState(false)
  const [is3d, setIs3d] = useState(false)
  const [activeTool, setActiveTool] = useState<MapTool>("browse")
  const [weatherValues, setWeatherValues] = useState<Record<string, string>>({})
  const [weatherOpen, setWeatherOpen] = useState(false)
  const [weatherStatus, setWeatherStatus] = useState("")
  const [intelOpen, setIntelOpen] = useState(false)
  const [mapItems, setMapItems] = useState<SavedMapItem[]>(loadMapItems)
  const [fieldNoteOpen, setFieldNoteOpen] = useState(false)
  const [fieldNotePoint, setFieldNotePoint] = useState<LocationPoint | null>(null)
  const [fieldNoteTitle, setFieldNoteTitle] = useState("Field note")
  const [fieldNoteText, setFieldNoteText] = useState("")
  const [fieldNotePhotos, setFieldNotePhotos] = useState<string[]>([])
  const [dropWaypointWithNote, setDropWaypointWithNote] = useState(false)
  const [waypointOpen, setWaypointOpen] = useState(false)
  const [waypointPoint, setWaypointPoint] = useState<LocationPoint | null>(null)
  const [waypointTitle, setWaypointTitle] = useState("Waypoint")
  const [waypointCategory, setWaypointCategory] = useState("Spot")
  const [waypointNote, setWaypointNote] = useState("")
  const [measurePoints, setMeasurePoints] = useState<LocationPoint[]>([])

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

  const visibleWeather = mapWeatherOptions.filter(
    (condition) => mapWeatherConditions[condition.key] ?? true
  )
  const measureDistance = useMemo(
    () =>
      measurePoints.slice(1).reduce((total, point, index) => {
        const previousPoint = measurePoints[index]
        return total + distanceBetween(previousPoint, point)
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
  const noteConditionChips = [
    {
      label: "Weather",
      value: `${weatherValues["weather.temperature"] || "-"} ${weatherValues["weather.cloudCover"] || ""}`.trim(),
    },
    {
      label: "Wind",
      value:
        weatherValues["weather.windDirection"] && weatherValues["weather.windSpeed"]
          ? `${weatherValues["weather.windDirection"]} ${weatherValues["weather.windSpeed"]}`
          : "-",
    },
    {
      label: "Moon",
      value:
        weatherValues["moon.moonIllumination"] && weatherValues["moon.moonPhase"]
          ? `${weatherValues["moon.moonIllumination"]} ${weatherValues["moon.moonPhase"]}`
          : "-",
    },
  ]
  const summaryEnabled = homeSummary.panel ?? true
  const summaryCopyEnabled =
    (homeSummary.location ?? true) || (homeSummary.gpsStatus ?? true)
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
    try {
      localStorage.setItem("catch-map-items", JSON.stringify(mapItems))
    } catch (error) {
      console.warn("Map items could not be saved locally.", error)
    }
  }, [mapItems])

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

  async function loadWeatherValues(statusLabel: string) {
    setWeatherStatus(statusLabel)

    try {
      const location = await getCurrentPosition()
      setCurrentLocation([location.latitude, location.longitude])
      const values = await getAutomaticEnvironmentData(
        location.latitude,
        location.longitude,
        pressureTrendHours
      )
      setWeatherValues(values)
      setWeatherStatus("Current weather")
      return values
    } catch {
      setWeatherStatus("Weather unavailable")
      throw new Error("Weather unavailable")
    }
  }

  async function openWeatherPanel() {
    if (weatherOpen) {
      setWeatherOpen(false)
      return
    }

    setWeatherOpen(true)
    setIntelOpen(false)
    closeFieldNote()
    closeWaypoint()
    setLayersOpen(false)
    await loadWeatherValues("Finding current weather...").catch(() => undefined)
  }

  async function openIntelPanel() {
    if (intelOpen) {
      setIntelOpen(false)
      return
    }

    setIntelOpen(true)
    setWeatherOpen(false)
    closeFieldNote()
    closeWaypoint()
    setLayersOpen(false)

    if (!weatherValues["weather.pressureTrend"]) {
      await loadWeatherValues("Building intel...").catch(() => undefined)
    }
  }

  async function setWaypointFromGps() {
    try {
      const location = await getCurrentPosition()
      setCurrentLocation([location.latitude, location.longitude])
      setWaypointPoint(location)
    } catch {
      setWaypointPoint(mapCenter)
    }
  }

  function closeFieldNote() {
    setFieldNoteOpen(false)
    setFieldNotePoint(null)
    setFieldNoteTitle("Field note")
    setFieldNoteText("")
    setFieldNotePhotos([])
    setDropWaypointWithNote(false)
  }

  function toggleFieldNote() {
    if (fieldNoteOpen) {
      closeFieldNote()
      return
    }

    setFieldNoteOpen(true)
    setFieldNotePoint(mapCenter)
    setIntelOpen(false)
    setWeatherOpen(false)
    closeWaypoint()
    setLayersOpen(false)

    if (!weatherValues["weather.temperature"]) {
      void loadWeatherValues("Capturing conditions...").catch(() => undefined)
    }
  }

  function closeWaypoint() {
    setWaypointOpen(false)
    setWaypointPoint(null)
    setWaypointTitle("Waypoint")
    setWaypointCategory("Spot")
    setWaypointNote("")
    setActiveTool("browse")
  }

  function toggleWaypoint() {
    if (waypointOpen || activeTool === "waypoint") {
      closeWaypoint()
      return
    }

    setActiveTool("waypoint")
    setWaypointOpen(true)
    setWaypointPoint(mapCenter)
    setIntelOpen(false)
    setWeatherOpen(false)
    closeFieldNote()
    setLayersOpen(false)
  }

  function toggleLayers() {
    setLayersOpen((open) => !open)
    setIntelOpen(false)
    setWeatherOpen(false)
    closeFieldNote()
    closeWaypoint()
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

  function saveFieldNote() {
    const title = fieldNoteTitle.trim() || "Field note"
    const point = fieldNotePoint ?? mapCenter
    const createdAt = new Date().toISOString()

    setMapItems((current) => [
      ...current,
      {
        id: Date.now(),
        type: "field-note",
        title,
        note: fieldNoteText.trim(),
        latitude: point.latitude,
        longitude: point.longitude,
        createdAt,
        photoDataUrls: fieldNotePhotos.length > 0 ? fieldNotePhotos : undefined,
      },
      ...(dropWaypointWithNote
        ? [
            {
              id: Date.now() + 1,
              type: "waypoint" as const,
              title,
              note: "Created from field note",
              category: "Field note",
              latitude: point.latitude,
              longitude: point.longitude,
              createdAt,
            },
          ]
        : []),
    ])
    closeFieldNote()
  }

  function saveWaypoint() {
    const point = waypointPoint ?? mapCenter
    const title = waypointTitle.trim() || "Waypoint"

    setMapItems((current) => [
      ...current,
      {
        id: Date.now(),
        type: "waypoint",
        title,
        note: waypointNote.trim(),
        category: waypointCategory.trim() || "Spot",
        latitude: point.latitude,
        longitude: point.longitude,
        createdAt: new Date().toISOString(),
      },
    ])
    setWaypointOpen(false)
    setWaypointPoint(null)
    setWaypointTitle("Waypoint")
    setWaypointCategory("Spot")
    setWaypointNote("")
    setActiveTool("browse")
  }

  function deleteMapItem(itemId: number) {
    setMapItems((current) => current.filter((item) => item.id !== itemId))
  }

  function toggleMapStyle(style: MapStyle) {
    setMapStyle(style)
    setLayersOpen(false)
  }

  function toggle3dMode() {
    setIs3d((enabled) => {
      const nextEnabled = !enabled

      if (nextEnabled) {
        setLayersOpen(false)
      }

      return nextEnabled
    })
  }

  return (
    <main className={`phone-map-screen${is3d ? " home-map-3d" : ""}`}>
      <HomeMap
        activeTool={activeTool}
        currentLocation={currentLocation}
        deleteMapItem={deleteMapItem}
        fieldNoteOpen={fieldNoteOpen}
        fieldNotePoint={fieldNotePoint}
        fieldNoteText={fieldNoteText}
        fieldNoteTitle={fieldNoteTitle}
        is3d={is3d}
        mapItems={mapItems}
        mappedCatches={mappedCatches}
        mapStyle={mapStyle}
        measurePoints={measurePoints}
        onCenterChange={setMapCenter}
        onFieldNotePoint={setFieldNotePoint}
        onMeasurePoint={(point) => setMeasurePoints((current) => [...current, point])}
        onWaypointPoint={(point) => {
          setWaypointPoint(point)
          setWaypointOpen(true)
        }}
        points={points}
        recenterRequest={recenterRequest}
        waypointCategory={waypointCategory}
        waypointNote={waypointNote}
        waypointOpen={waypointOpen}
        waypointPoint={waypointPoint}
        waypointTitle={waypointTitle}
      />

      {summaryEnabled && (
        <section className="map-top-panel" aria-label="Current fishing summary">
          {summaryCopyEnabled && (
            <div className="map-top-copy">
              {(homeSummary.location ?? true) && <h1>{locationTitle}</h1>}
              {(homeSummary.gpsStatus ?? true) && (
                <span className="gps-pill">{locationStatus}</span>
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
        {(homeMapControls.fieldNote ?? true) && (
          <button
            className={`home-tool-button${fieldNoteOpen ? " active" : ""}`}
            type="button"
            onClick={toggleFieldNote}
          >
            <span>FN</span>
            Field Note
          </button>
        )}
        {(homeMapControls.waypoint ?? true) && (
          <button
            className={`home-tool-button${activeTool === "waypoint" ? " active" : ""}`}
            type="button"
            onClick={toggleWaypoint}
          >
            <span>+</span>
            Waypoint
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
        {(homeMapControls.threeD ?? true) && (
          <button
            className={`home-tool-button${is3d ? " active" : ""}`}
            type="button"
            onClick={toggle3dMode}
          >
            <span>3D</span>
            3D
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

              setIntelOpen(false)
              setWeatherOpen(false)
              closeFieldNote()
              closeWaypoint()
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
            <button type="button" onClick={() => setWeatherOpen(false)}>Close</button>
          </header>
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
        <section className="map-tool-card home-map-tool-card">
          <header>
            <h2>Murray Cod Intel</h2>
            <button type="button" onClick={() => setIntelOpen(false)}>Close</button>
          </header>
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
              <p>Field Note</p>
              <h2>
                Logged now · {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
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
          <section className="captured-note-conditions">
            <h3>Captured with this note</h3>
            <div>
              {noteConditionChips.map((chip) => (
                <p key={chip.label}>
                  <strong>{chip.value}</strong>
                  <span>{chip.label}</span>
                </p>
              ))}
            </div>
          </section>
          <label className="drop-waypoint-toggle">
            <span>Drop waypoint at this location</span>
            <input
              type="checkbox"
              checked={dropWaypointWithNote}
              onChange={(event) => setDropWaypointWithNote(event.target.checked)}
            />
          </label>
          <button className="primary-button field-note-save" type="button" onClick={saveFieldNote}>
            Save Field Note
          </button>
        </section>
      )}

      {waypointOpen && (homeMapControls.waypoint ?? true) && (
        <section className="map-tool-card home-map-tool-card">
          <header>
            <h2>Waypoint</h2>
            <button type="button" onClick={closeWaypoint}>Close</button>
          </header>
          <div className="split-input-row">
            <label>
              Name
              <input
                value={waypointTitle}
                onChange={(event) => setWaypointTitle(event.target.value)}
              />
            </label>
            <label>
              Category
              <input
                value={waypointCategory}
                onChange={(event) => setWaypointCategory(event.target.value)}
              />
            </label>
          </div>
          <label>
            Notes
            <textarea
              value={waypointNote}
              onChange={(event) => setWaypointNote(event.target.value)}
            />
          </label>
          <div className="map-card-actions">
            <button className="ghost-button" type="button" onClick={() => void setWaypointFromGps()}>
              Use GPS
            </button>
            <button className="primary-button" type="button" onClick={saveWaypoint}>
              Save Waypoint
            </button>
          </div>
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
        <button type="button" onClick={onOpenRecords}>
          <span>Records</span>
        </button>
        <button type="button" onClick={onOpenCatches}>
          <span>My Catches</span>
        </button>
        <button
          className="record-tab"
          type="button"
          onClick={onRecordCatch}
          aria-label="Record catch"
        >
          <span>+</span>
          <small>Record</small>
        </button>
        <button type="button" onClick={onOpenStats}>
          <span>Stats</span>
        </button>
        <button type="button" onClick={onOpenSettings}>
          <span>Settings</span>
        </button>
      </nav>
    </main>
  )
}

export default Home
