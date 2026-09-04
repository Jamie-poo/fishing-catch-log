import { useEffect, useMemo, useRef, useState } from "react"
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
import {
  getLocationNameFromCoordinates,
} from "../../data/location"
import { mapWeatherOptions } from "../../data/mapWeather"
import { useCatches } from "../../data/useCatches"
import { useCatchLogSettings } from "../../data/useCatchLogSettings"

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

const currentLocationIcon = L.divIcon({
  className: "current-location-marker",
  html: "<span></span>",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

const waypointIcon = L.divIcon({
  className: "map-tool-marker waypoint-marker",
  html: "<span>W</span>",
  iconSize: [34, 34],
  iconAnchor: [17, 17],
})

const fieldNoteIcon = L.divIcon({
  className: "map-tool-marker field-note-marker",
  html: "<span>N</span>",
  iconSize: [34, 34],
  iconAnchor: [17, 17],
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
}

type MapStyle = keyof typeof mapTiles

type MapTool = "browse" | "waypoint" | "measure"

type MapViewportProps = {
  currentLocation: [number, number] | null
  points: [number, number][]
  recenterRequest: number
}

type MapToolEventsProps = {
  activeTool: MapTool
  onCenterChange: (point: LocationPoint) => void
  onMeasurePoint: (point: LocationPoint) => void
  onWaypointPoint: (point: LocationPoint) => void
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

function parseFirstNumber(value: string | undefined) {
  const match = value?.match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

function buildIntel(weatherValues: Record<string, string>) {
  const pressureTrend = weatherValues["weather.pressureTrend"] ?? ""
  const windSpeed = parseFirstNumber(weatherValues["weather.windSpeed"])
  const rain = parseFirstNumber(weatherValues["weather.rain"])
  const recentRain = parseFirstNumber(weatherValues["weather.recentRainAmount"])
  const dayNight = weatherValues["sun.dayNight"] ?? ""
  let score = 54

  if (pressureTrend.includes("Rising")) score += 16
  if (pressureTrend.includes("Steady")) score += 10
  if (pressureTrend.includes("Falling")) score -= 12
  if (windSpeed !== null && windSpeed >= 6 && windSpeed <= 22) score += 8
  if (windSpeed !== null && windSpeed > 35) score -= 12
  if (rain !== null && rain > 0 && rain <= 2) score += 5
  if (rain !== null && rain > 6) score -= 8
  if (recentRain !== null && recentRain > 0 && recentRain <= 20) score += 5
  if (dayNight === "Day") score += 3

  const boundedScore = Math.min(95, Math.max(10, score))
  const label =
    boundedScore >= 75
      ? "Strong"
      : boundedScore >= 58
        ? "Worth a look"
        : "Patchy"
  const pressureSummary = pressureTrend || "Pressure trend unavailable"
  const windSummary =
    weatherValues["weather.windSpeed"] && weatherValues["weather.windDirection"]
      ? `${weatherValues["weather.windDirection"]} ${weatherValues["weather.windSpeed"]}`
      : weatherValues["weather.windSpeed"] || "Wind unavailable"

  return {
    label,
    score: boundedScore,
    summary: `${pressureSummary}. Wind ${windSummary}.`,
    rows: [
      ["Pressure", pressureTrend || "-"],
      ["Wind", windSummary],
      ["Rain now", weatherValues["weather.rain"] || "-"],
      ["Rain last 24h", weatherValues["weather.recentRainAmount"] || "-"],
      ["Light", dayNight || "-"],
      ["Moon", weatherValues["moon.moonPhase"] || "-"],
    ],
  }
}

function MapViewport({ currentLocation, points, recenterRequest }: MapViewportProps) {
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

  return null
}

function MapToolEvents({
  activeTool,
  onCenterChange,
  onMeasurePoint,
  onWaypointPoint,
}: MapToolEventsProps) {
  const map = useMapEvents({
    click(event) {
      const point = {
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      }

      if (activeTool === "measure") {
        onMeasurePoint(point)
        return
      }

      if (activeTool === "waypoint") {
        onWaypointPoint(point)
      }
    },
    moveend() {
      const center = map.getCenter()
      onCenterChange({
        latitude: center.lat,
        longitude: center.lng,
      })
    },
  })

  useEffect(() => {
    const center = map.getCenter()
    onCenterChange({
      latitude: center.lat,
      longitude: center.lng,
    })
  }, [map, onCenterChange])

  return null
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
  const { mapWeatherConditions, pressureTrendHours } = useCatchLogSettings()
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
  const [is3d, setIs3d] = useState(false)
  const [activeTool, setActiveTool] = useState<MapTool>("browse")
  const [weatherValues, setWeatherValues] = useState<Record<string, string>>({})
  const [weatherOpen, setWeatherOpen] = useState(false)
  const [weatherStatus, setWeatherStatus] = useState("")
  const [intelOpen, setIntelOpen] = useState(false)
  const [mapItems, setMapItems] = useState<SavedMapItem[]>(loadMapItems)
  const [fieldNoteOpen, setFieldNoteOpen] = useState(false)
  const [fieldNoteTitle, setFieldNoteTitle] = useState("Field note")
  const [fieldNoteText, setFieldNoteText] = useState("")
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
  const intel = useMemo(() => buildIntel(weatherValues), [weatherValues])

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
    setWeatherOpen(true)
    setIntelOpen(false)
    await loadWeatherValues("Finding current weather...").catch(() => undefined)
  }

  async function openIntelPanel() {
    setIntelOpen(true)
    setWeatherOpen(false)

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

  function saveFieldNote() {
    const title = fieldNoteTitle.trim() || "Field note"

    setMapItems((current) => [
      ...current,
      {
        id: Date.now(),
        type: "field-note",
        title,
        note: fieldNoteText.trim(),
        latitude: mapCenter.latitude,
        longitude: mapCenter.longitude,
        createdAt: new Date().toISOString(),
      },
    ])
    setFieldNoteOpen(false)
    setFieldNoteTitle("Field note")
    setFieldNoteText("")
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
    setMapStyle((current) => current === style ? "standard" : style)
  }

  return (
    <main className={`phone-map-screen${is3d ? " home-map-3d" : ""}`}>
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
        />
        <MapToolEvents
          activeTool={activeTool}
          onCenterChange={setMapCenter}
          onMeasurePoint={(point) => setMeasurePoints((current) => [...current, point])}
          onWaypointPoint={(point) => {
            setWaypointPoint(point)
            setWaypointOpen(true)
          }}
        />
        {currentLocation && (
          <Marker icon={currentLocationIcon} position={currentLocation}>
            <Popup>You are here</Popup>
          </Marker>
        )}
        {mappedCatches.map((fish) => (
          <Marker
            key={fish.id}
            icon={markerIcon}
            position={[fish.latitude!, fish.longitude!]}
          >
            <Popup>
              <strong>{fish.species || "Unknown species"}</strong>
              <br />
              {fish.locationName || "Location saved"}
            </Popup>
          </Marker>
        ))}
        {mapItems.map((item) => (
          <Marker
            key={item.id}
            icon={item.type === "waypoint" ? waypointIcon : fieldNoteIcon}
            position={[item.latitude, item.longitude]}
          >
            <Popup>
              <strong>{item.title}</strong>
              <br />
              {item.type === "waypoint" && item.category ? `${item.category} waypoint` : "Field note"}
              {item.note && (
                <>
                  <br />
                  {item.note}
                </>
              )}
              <br />
              <button type="button" onClick={() => deleteMapItem(item.id)}>
                Delete
              </button>
            </Popup>
          </Marker>
        ))}
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

      <section className="map-top-panel" aria-label="Current fishing summary">
        <div className="map-location-preview" aria-hidden="true"></div>
        <div className="map-top-copy">
          <h1>{locationTitle}</h1>
          <span className="gps-pill">{locationStatus}</span>
        </div>
        <div className="map-metrics">
          <div>
            <strong>{new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</strong>
            <span>time</span>
          </div>
          <div>
            <strong>{catches.length}</strong>
            <span>logged</span>
          </div>
          <div>
            <strong>{speciesCount}</strong>
            <span>species</span>
          </div>
          <button type="button" onClick={onOpenCatchMap}>
            Map
          </button>
        </div>
      </section>

      <div className="home-side-tools home-left-tools" aria-label="Quick actions">
        <button
          className={`home-tool-button primary-map-tool${fieldNoteOpen ? " active" : ""}`}
          type="button"
          onClick={() => {
            setFieldNoteOpen((open) => !open)
            setIntelOpen(false)
            setWeatherOpen(false)
          }}
        >
          <span>FN</span>
          Field Note
        </button>
        <button
          className={`home-tool-button${activeTool === "waypoint" ? " active" : ""}`}
          type="button"
          onClick={() => {
            setActiveTool(activeTool === "waypoint" ? "browse" : "waypoint")
            setWaypointOpen(true)
            setWaypointPoint(mapCenter)
            setIntelOpen(false)
            setWeatherOpen(false)
          }}
        >
          <span>WP</span>
          Waypoint
        </button>
        <button
          className="home-tool-button record-map-tool"
          type="button"
          onClick={onRecordCatch}
        >
          <span>+</span>
          Record
        </button>
        <button
          type="button"
          className="home-tool-button"
          disabled={!currentLocation}
          onClick={() => setRecenterRequest((current) => current + 1)}
        >
          <span>GPS</span>
          Recenter
        </button>
      </div>

      <div className="home-side-tools home-right-tools" aria-label="Map tools">
        <button
          className={`home-tool-button${weatherOpen ? " active" : ""}`}
          type="button"
          onClick={() => void openWeatherPanel()}
        >
          <span>WX</span>
          Weather
        </button>
        <button
          className={`home-tool-button${intelOpen ? " active" : ""}`}
          type="button"
          onClick={() => void openIntelPanel()}
        >
          <span>IN</span>
          Intel
        </button>
        <button
          className={`home-tool-button${mapStyle === "topo" ? " active" : ""}`}
          type="button"
          onClick={() => toggleMapStyle("topo")}
        >
          <span>TO</span>
          Topo
        </button>
        <button
          className={`home-tool-button${is3d ? " active" : ""}`}
          type="button"
          onClick={() => setIs3d((enabled) => !enabled)}
        >
          <span>3D</span>
          3D
        </button>
        <button
          className={`home-tool-button${activeTool === "measure" ? " active" : ""}`}
          type="button"
          onClick={() => setActiveTool(activeTool === "measure" ? "browse" : "measure")}
        >
          <span>MS</span>
          Measure
        </button>
        <button
          className={`home-tool-button${mapStyle === "satellite" ? " active" : ""}`}
          type="button"
          onClick={() => toggleMapStyle("satellite")}
        >
          <span>ST</span>
          Sat
        </button>
      </div>

      {weatherOpen && (
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

      {intelOpen && (
        <section className="map-tool-card home-map-tool-card">
          <header>
            <h2>Intel</h2>
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

      {fieldNoteOpen && (
        <section className="map-tool-card home-map-tool-card">
          <header>
            <h2>Field Note</h2>
            <button type="button" onClick={() => setFieldNoteOpen(false)}>Close</button>
          </header>
          <label>
            Title
            <input
              value={fieldNoteTitle}
              onChange={(event) => setFieldNoteTitle(event.target.value)}
            />
          </label>
          <label>
            Note
            <textarea
              value={fieldNoteText}
              onChange={(event) => setFieldNoteText(event.target.value)}
            />
          </label>
          <button className="primary-button" type="button" onClick={saveFieldNote}>
            Save Field Note
          </button>
        </section>
      )}

      {waypointOpen && (
        <section className="map-tool-card home-map-tool-card">
          <header>
            <h2>Waypoint</h2>
            <button type="button" onClick={() => setWaypointOpen(false)}>Close</button>
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

      {activeTool === "measure" && (
        <section className="measure-readout home-measure-readout">
          <strong>{formatDistance(measureDistance)}</strong>
          <button type="button" onClick={() => setMeasurePoints([])}>Clear</button>
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
