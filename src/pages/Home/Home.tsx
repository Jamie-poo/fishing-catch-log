import { useEffect, useMemo, useRef, useState } from "react"
import L from "leaflet"
import {
  LayersControl,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet"
import "leaflet/dist/leaflet.css"
import {
  formatCoordinateLocation,
  getLocationNameFromCoordinates,
} from "../../data/location"
import { useCatches } from "../../data/useCatches"

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

type HomeProps = {
  onOpenCatches: () => void
  onOpenStats: () => void
  onOpenCatchMap: () => void
  onOpenRecords: () => void
  onOpenSettings: () => void
  onRecordCatch: () => void
}

type MapViewportProps = {
  currentLocation: [number, number] | null
  points: [number, number][]
  recenterRequest: number
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

function Home({
  onOpenCatches,
  onOpenStats,
  onOpenCatchMap,
  onOpenRecords,
  onOpenSettings,
  onRecordCatch,
}: HomeProps) {
  const { catches } = useCatches()
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
        setLocationTitle(formatCoordinateLocation(nextLocation[0], nextLocation[1]))
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
          setLocationTitle(formatCoordinateLocation(latitude, longitude))
        }
      })

    return () => controller.abort()
  }, [currentLocation])

  return (
    <main className="phone-map-screen">
      <MapContainer
        center={[-37.25, 144.9]}
        zoom={7}
        className="home-map"
        zoomControl={false}
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

        <MapViewport
          currentLocation={currentLocation}
          points={points}
          recenterRequest={recenterRequest}
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
      </MapContainer>

      <button
        type="button"
        className="recenter-button"
        disabled={!currentLocation}
        onClick={() => setRecenterRequest((current) => current + 1)}
      >
        Recenter
      </button>

      <section className="map-top-panel" aria-label="Current fishing summary">
        <h1>{locationTitle}</h1>
        <div className="map-metrics">
          <div>
            <strong>{new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</strong>
            <span>{locationStatus}</span>
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
          +
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
