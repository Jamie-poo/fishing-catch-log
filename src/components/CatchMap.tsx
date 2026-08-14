import { useEffect, useState } from "react"
import L from "leaflet"
import {
  LayersControl,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet"
import "leaflet/dist/leaflet.css"

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

type CatchMapProps = {
  latitude: number
  longitude: number
  onLocationChange?: (latitude: number, longitude: number) => void
  height?: number
  hasSavedLocation?: boolean
}

type MapCentreTrackerProps = {
  onCentreChange: (latitude: number, longitude: number) => void
}

function MapCentreTracker({ onCentreChange }: MapCentreTrackerProps) {
  useMapEvents({
    moveend(event) {
      const centre = event.target.getCenter()
      onCentreChange(centre.lat, centre.lng)
    },
  })

  return null
}

function RecenterMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap()

  useEffect(() => {
    map.setView([latitude, longitude], map.getZoom())
  }, [latitude, longitude, map])

  return null
}

function CatchMap({
  latitude,
  longitude,
  onLocationChange,
  height = 400,
  hasSavedLocation = true,
}: CatchMapProps) {
  const [selectedLatitude, setSelectedLatitude] = useState(latitude)
  const [selectedLongitude, setSelectedLongitude] = useState(longitude)

  function handleCentreChange(newLatitude: number, newLongitude: number) {
    setSelectedLatitude(newLatitude)
    setSelectedLongitude(newLongitude)
  }

  function saveLocation() {
    if (onLocationChange) {
      onLocationChange(selectedLatitude, selectedLongitude)
    }
  }

  return (
    <div className="embedded-map">
      <div
        style={{
          position: "relative",
          height: `${height}px`,
          width: "100%",
        }}
      >
        <MapContainer
          center={[latitude, longitude]}
          zoom={15}
          style={{
            height: "100%",
            width: "100%",
          }}
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Standard">
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellite">
              <TileLayer
                attribution="Tiles &copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          <RecenterMap latitude={latitude} longitude={longitude} />
          {hasSavedLocation && (
            <Marker position={[latitude, longitude]} icon={markerIcon} />
          )}

          {onLocationChange && (
            <MapCentreTracker onCentreChange={handleCentreChange} />
          )}
        </MapContainer>

        {onLocationChange && <div className="map-crosshair">+</div>}
      </div>

      {onLocationChange && (
        <div className="map-location-actions">
          <p>
            {hasSavedLocation ? "Selected location:" : "Unsaved map position:"}
            <br />
            {selectedLatitude.toFixed(6)}, {selectedLongitude.toFixed(6)}
          </p>

          <button className="primary-button" onClick={saveLocation}>
            Use This Location
          </button>
        </div>
      )}
    </div>
  )
}

export default CatchMap
