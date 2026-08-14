import { useEffect, useMemo, useState } from "react"
import {
  LayersControl,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
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

type CatchMapProps = {
  onBackHome: () => void
}

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

function MapViewport({ points }: MapViewportProps) {
  const map = useMap()

  useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(points, { padding: [36, 36], maxZoom: 13 })
    }
  }, [map, points])

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

function CatchMap({ onBackHome }: CatchMapProps) {
  const { catches } = useCatches()
  const { lengthUnit, mapFilters, weightUnit } = useCatchLogSettings()
  const [speciesFilter, setSpeciesFilter] = useState("")
  const [locationFilter, setLocationFilter] = useState("")
  const [minLength, setMinLength] = useState("")
  const [minWeight, setMinWeight] = useState("")

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

  function clearFilters() {
    setSpeciesFilter("")
    setLocationFilter("")
    setMinLength("")
    setMinWeight("")
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

      <div className="map-panel">
        <MapContainer
          center={[-37.25, 144.9]}
          zoom={7}
          style={{ height: "100%", width: "100%" }}
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
        </MapContainer>
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
