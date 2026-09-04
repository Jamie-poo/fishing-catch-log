import { useEffect, useMemo, useRef, useState } from "react"
import {
  CircleMarker,
  LayersControl,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { getAutomaticEnvironmentData } from "../../data/environmentData"
import { mapWeatherOptions } from "../../data/mapWeather"
import {
  formatLength,
  formatWeight,
  inchesToCentimeters,
  poundsOuncesToKilograms,
} from "../../data/measurements"
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

type CatchMapProps = {
  onBackHome: () => void
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

type MapTool = "browse" | "waypoint" | "measure"

type MapViewportProps = {
  points: [number, number][]
}

type AutocompleteFilterProps = {
  label: string
  options: string[]
  placeholder: string
  value: string
  onChange: (value: string) => void
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

function MapViewport({ points }: MapViewportProps) {
  const map = useMap()
  const hasSetInitialView = useRef(false)

  useEffect(() => {
    if (hasSetInitialView.current) {
      return
    }

    if (points.length > 0) {
      hasSetInitialView.current = true
      map.fitBounds(points, { padding: [36, 36], maxZoom: 13 })
    }
  }, [map, points])

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

function AutocompleteFilter({
  label,
  options,
  placeholder,
  value,
  onChange,
}: AutocompleteFilterProps) {
  const [focused, setFocused] = useState(false)
  const matchingOptions = options
    .filter((option) => option.toLowerCase().includes(value.toLowerCase()))
    .slice(0, 8)
  const showSuggestions = focused && value !== "" && matchingOptions.length > 0

  return (
    <div className="autocomplete-filter">
      <label>
        {label}
        <br />
        <input
          type="text"
          value={value}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
        />
      </label>

      {showSuggestions && (
        <div className="autocomplete-suggestions">
          {matchingOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option)
                setFocused(false)
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function textMatchesFilter(value: string | undefined, filter: string) {
  return value?.toLowerCase().includes(filter.toLowerCase()) ?? false
}

function formatDistance(meters: number) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`
  }

  return `${Math.round(meters)} m`
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

function CatchMap({ onBackHome }: CatchMapProps) {
  const { catches } = useCatches()
  const {
    lengthUnit,
    mapFilters,
    mapWeatherConditions,
    pressureTrendHours,
    weightUnit,
  } = useCatchLogSettings()
  const [speciesFilter, setSpeciesFilter] = useState("")
  const [locationFilter, setLocationFilter] = useState("")
  const [minLength, setMinLength] = useState("")
  const [minWeight, setMinWeight] = useState("")
  const [activeTool, setActiveTool] = useState<MapTool>("browse")
  const [is3d, setIs3d] = useState(false)
  const [mapCenter, setMapCenter] = useState<LocationPoint>({
    latitude: -37.25,
    longitude: 144.9,
  })
  const [currentLocation, setCurrentLocation] = useState<LocationPoint | null>(null)
  const [weatherValues, setWeatherValues] = useState<Record<string, string>>({})
  const [weatherStatus, setWeatherStatus] = useState("")
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

  useEffect(() => {
    localStorage.setItem("catch-map-items", JSON.stringify(mapItems))
  }, [mapItems])

  const species = useMemo(
    () =>
      [...new Set(catches.map((fish) => fish.species.trim()).filter(Boolean))]
        .sort((first, second) => first.localeCompare(second)),
    [catches]
  )

  const locations = useMemo(
    () =>
      [
        ...new Set(
          catches
            .map((fish) => fish.locationName?.trim() ?? "")
            .filter(Boolean)
        ),
      ].sort((first, second) => first.localeCompare(second)),
    [catches]
  )

  const filteredCatches = catches.filter((fish) => {
    const minimumLength =
      minLength === ""
        ? null
        : lengthUnit === "in"
          ? inchesToCentimeters(Number(minLength))
          : Number(minLength)
    const minimumWeight =
      minWeight === ""
        ? null
        : weightUnit === "lb-oz"
          ? poundsOuncesToKilograms(Number(minWeight), 0)
          : Number(minWeight)
    const matchesSpecies =
      !(mapFilters.species ?? true) ||
      speciesFilter === "" ||
      textMatchesFilter(fish.species, speciesFilter)
    const matchesLocation =
      !(mapFilters.location ?? true) ||
      locationFilter === "" ||
      textMatchesFilter(fish.locationName, locationFilter)
    const matchesLength =
      !(mapFilters.minLength ?? true) ||
      minimumLength === null ||
      (fish.length !== null && fish.length >= minimumLength)
    const matchesWeight =
      !(mapFilters.minWeight ?? true) ||
      minimumWeight === null ||
      (fish.weight !== null && fish.weight >= minimumWeight)

    return matchesSpecies && matchesLocation && matchesLength && matchesWeight
  })

  const mappedCatches = filteredCatches.filter(
    (fish) => fish.latitude !== null && fish.longitude !== null
  )
  const points = mappedCatches.map(
    (fish) => [fish.latitude!, fish.longitude!] as [number, number]
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
  const visibleWeather = mapWeatherOptions.filter(
    (condition) => mapWeatherConditions[condition.key] ?? true
  )

  function clearFilters() {
    setSpeciesFilter("")
    setLocationFilter("")
    setMinLength("")
    setMinWeight("")
  }

  async function loadCurrentWeather() {
    setWeatherStatus("Finding current weather...")

    try {
      const location = await getCurrentPosition()
      setCurrentLocation(location)
      const values = await getAutomaticEnvironmentData(
        location.latitude,
        location.longitude,
        pressureTrendHours
      )
      setWeatherValues(values)
      setWeatherStatus("Current weather")
    } catch {
      setWeatherStatus("Weather unavailable")
    }
  }

  async function setWaypointFromGps() {
    try {
      const location = await getCurrentPosition()
      setCurrentLocation(location)
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

  return (
    <main className="app-page">
      <header className="page-topbar">
        <button className="ghost-button" onClick={onBackHome}>Home</button>
        <h1>Catch Map</h1>
      </header>

      <p className="page-note">
        Showing {mappedCatches.length} mapped catches from {filteredCatches.length} matching catches.
      </p>

      <section className="filter-panel">
        <h2>Filters</h2>
        <div className="filter-grid">
          {(mapFilters.species ?? true) && (
            <AutocompleteFilter
              label="Species"
              options={species}
              placeholder="Type a species"
              value={speciesFilter}
              onChange={setSpeciesFilter}
            />
          )}

          {(mapFilters.location ?? true) && (
            <AutocompleteFilter
              label="Location"
              options={locations}
              placeholder="Type a location"
              value={locationFilter}
              onChange={setLocationFilter}
            />
          )}

          {(mapFilters.minLength ?? true) && (
            <label>
              Minimum length ({lengthUnit})
              <br />
              <input
                type="number"
                min="0"
                value={minLength}
                onChange={(event) => setMinLength(event.target.value)}
                placeholder={lengthUnit === "in" ? "e.g. 20" : "e.g. 50"}
              />
            </label>
          )}

          {(mapFilters.minWeight ?? true) && (
            <label>
              Minimum weight ({weightUnit === "lb-oz" ? "lb" : "kg"})
              <br />
              <input
                type="number"
                min="0"
                step="any"
                value={minWeight}
                onChange={(event) => setMinWeight(event.target.value)}
                placeholder={weightUnit === "lb-oz" ? "e.g. 4" : "e.g. 2"}
              />
            </label>
          )}

          <button className="ghost-button" onClick={clearFilters}>Clear filters</button>
        </div>
      </section>

      <div className={`map-panel map-panel-tools${is3d ? " map-panel-3d" : ""}`}>
        <MapContainer
          center={[-37.25, 144.9]}
          zoom={7}
          className="tool-map"
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Standard">
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Terrain">
              <TileLayer
                attribution="&copy; OpenTopoMap contributors"
                url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellite">
              <TileLayer
                attribution="Tiles &copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            </LayersControl.BaseLayer>
          </LayersControl>
          <MapViewport points={points} />
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
            <CircleMarker
              center={[currentLocation.latitude, currentLocation.longitude]}
              pathOptions={{ color: "#ffffff", fillColor: "#1a8cff", fillOpacity: 1, weight: 3 }}
              radius={8}
            >
              <Popup>You are here</Popup>
            </CircleMarker>
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
                Length: {formatLength(fish.length, lengthUnit)}
                <br />
                Weight: {formatWeight(fish.weight, weightUnit)}
                <br />
                {new Date(fish.dateTime).toLocaleDateString()}
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

        <div className="map-tool-bar" aria-label="Map tools">
          <button
            className={weatherStatus === "Current weather" ? "active" : ""}
            type="button"
            onClick={() => void loadCurrentWeather()}
          >
            Weather
          </button>
          <button
            className={fieldNoteOpen ? "active" : ""}
            type="button"
            onClick={() => setFieldNoteOpen((open) => !open)}
          >
            Field Note
          </button>
          <button
            className={activeTool === "waypoint" ? "active" : ""}
            type="button"
            onClick={() => {
              setActiveTool(activeTool === "waypoint" ? "browse" : "waypoint")
              setWaypointOpen(true)
              setWaypointPoint(mapCenter)
            }}
          >
            Waypoint
          </button>
          <button
            className={is3d ? "active" : ""}
            type="button"
            onClick={() => setIs3d((enabled) => !enabled)}
          >
            3D
          </button>
          <button
            className={activeTool === "measure" ? "active" : ""}
            type="button"
            onClick={() => setActiveTool(activeTool === "measure" ? "browse" : "measure")}
          >
            Measure
          </button>
        </div>

        {weatherStatus && (
          <section className="map-tool-card map-weather-card">
            <header>
              <h2>{weatherStatus}</h2>
              <button type="button" onClick={() => setWeatherStatus("")}>Close</button>
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

        {fieldNoteOpen && (
          <section className="map-tool-card">
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
          <section className="map-tool-card">
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
          <section className="measure-readout">
            <strong>{formatDistance(measureDistance)}</strong>
            <button type="button" onClick={() => setMeasurePoints([])}>Clear</button>
          </section>
        )}
      </div>

      {filteredCatches.length > mappedCatches.length && (
        <p className="page-note">
          {filteredCatches.length - mappedCatches.length} matching catch{filteredCatches.length - mappedCatches.length === 1 ? "" : "es"} do not have a saved location yet.
        </p>
      )}
    </main>
  )
}

export default CatchMap
