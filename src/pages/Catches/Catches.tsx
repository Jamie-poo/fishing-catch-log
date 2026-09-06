import { useCallback, useEffect, useRef, useState } from "react"
import CatchMap from "../../components/CatchMap"
import PhotoAddMenu from "../../components/PhotoAddMenu"
import PhotoPicker from "../../components/PhotoPicker"
import type { CatchRecord } from "../../data/catchData"
import { getCatchPhotos, withCatchPhotos } from "../../data/catchPhotos"
import { catchFieldGroups, fieldId, type CatchField, type CatchFieldGroup } from "../../data/catchStructure"
import { getAutomaticEnvironmentData } from "../../data/environmentData"
import { getLocationNameFromCoordinates } from "../../data/location"
import {
  centimetersToInches,
  formatLength,
  formatWeight,
  inchesToCentimeters,
  kilogramsToPoundsOunces,
  poundsOuncesToKilograms,
} from "../../data/measurements"
import { useCatches } from "../../data/useCatches"
import { useCatchLogSettings } from "../../data/useCatchLogSettings"

type CatchesProps = {
  onBackHome: () => void
  startInRecordMode?: boolean
}
type FormValues = Record<string, string>
type FormLocation = {
  latitude: number
  longitude: number
} | null

const DEFAULT_LOCATION = {
  latitude: -33.8688,
  longitude: 151.2093,
}

function toLocalDateTime(value: string) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function emptyForm(): FormValues {
  const values: FormValues = {}
  catchFieldGroups.forEach((group) => group.fields.forEach((field) => { values[fieldId(group.key, field.key)] = "" }))
  values["header.dateTime"] = toLocalDateTime(new Date().toISOString())
  return values
}

function formFromCatch(fish: CatchRecord): FormValues {
  const values = emptyForm()
  values["header.species"] = fish.species
  values["header.length"] = fish.length === null ? "" : String(fish.length)
  values["header.weight"] = fish.weight === null ? "" : String(fish.weight)
  values["header.locationName"] = fish.locationName ?? ""
  values["header.dateTime"] = toLocalDateTime(fish.dateTime)
  values["journal.catchNotes"] = fish.details?.journal?.catchNotes ?? fish.notes

  Object.entries(fish.details ?? {}).forEach(([groupKey, details]) => {
    Object.entries(details).forEach(([key, value]) => { values[fieldId(groupKey, key)] = value })
  })

  return values
}

function detailsFromForm(values: FormValues) {
  return Object.fromEntries(
    catchFieldGroups
      .filter((group) => group.key !== "header")
      .map((group) => [
        group.key,
        Object.fromEntries(group.fields.map((field) => [field.key, values[fieldId(group.key, field.key)] ?? ""]).filter(([, value]) => value !== "")),
      ])
      .filter(([, values]) => Object.keys(values).length > 0)
  )
}

function cleanInputNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function valueAlreadyHasDepthUnit(value: string) {
  return /\b(m|metre|meter|metres|meters|ft|feet|foot)\b/i.test(value)
}

function getPressureTrendHours(value: string) {
  const match = value.match(/over\s+(\d+)(h|d)/i)
  if (!match) return null
  const amount = Number(match[1])
  return match[2].toLowerCase() === "d" ? amount * 24 : amount
}

function Catches({ onBackHome, startInRecordMode = false }: CatchesProps) {
  const { catches, setCatches } = useCatches()
  const { depthUnit, groups, fields, lengthUnit, pressureTrendHours, weightUnit } = useCatchLogSettings()
  const [showForm, setShowForm] = useState(startInRecordMode)
  const [selectedCatchId, setSelectedCatchId] = useState<number | null>(null)
  const [editingCatchId, setEditingCatchId] = useState<number | null>(null)
  const [formValues, setFormValues] = useState<FormValues>(emptyForm)
  const [fishPhotos, setFishPhotos] = useState<string[]>([])
  const [formLocation, setFormLocation] = useState<FormLocation>(null)
  const [environmentStatus, setEnvironmentStatus] = useState("")
  const [locationStatus, setLocationStatus] = useState("")
  const [galleryCatchId, setGalleryCatchId] = useState<number | null>(null)
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState<number | null>(null)
  const attemptedAutomaticLocation = useRef(false)
  const selectedCatch =
    selectedCatchId === null
      ? null
      : catches.find((fish) => fish.id === selectedCatchId) ?? null
  const galleryCatch =
    galleryCatchId === null
      ? null
      : catches.find((fish) => fish.id === galleryCatchId) ?? null

  const fillLocationNameFromCoordinates = useCallback(async (
    latitude: number,
    longitude: number,
    replaceExisting: boolean
  ) => {
    try {
      const locationName = await getLocationNameFromCoordinates(latitude, longitude)
      setFormValues((current) => {
        if (!replaceExisting && current["header.locationName"]) {
          return current
        }

        return {
          ...current,
          "header.locationName": locationName,
        }
      })
    } catch {
      setFormValues((current) => {
        if (!replaceExisting && current["header.locationName"]) {
          return current
        }

        return current
      })
    }
  }, [])

  const fillEnvironmentFromCoordinates = useCallback(async (
    latitude: number,
    longitude: number,
    replaceExisting: boolean
  ) => {
    setEnvironmentStatus("Adding automatic weather, sun, and moon data...")

    try {
      const environmentValues = await getAutomaticEnvironmentData(latitude, longitude, pressureTrendHours)
      setFormValues((current) => {
        const nextValues = { ...current }

        Object.entries(environmentValues).forEach(([key, value]) => {
          if (!value) return
          if (!replaceExisting && nextValues[key]) return
          nextValues[key] = value
        })

        return nextValues
      })
      setEnvironmentStatus("Weather, sun, and moon data added.")
    } catch {
      setEnvironmentStatus("Automatic environmental data could not be added.")
    }
  }, [pressureTrendHours])

  const requestCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus("GPS is not available. Move the map to choose the spot.")
      return
    }

    setLocationStatus("Finding your current location...")

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude
        const longitude = position.coords.longitude

        setFormLocation({
          latitude,
          longitude,
        })
        setLocationStatus("Current location added. Move the map to fine tune it.")
        void fillLocationNameFromCoordinates(latitude, longitude, false)
        void fillEnvironmentFromCoordinates(latitude, longitude, false)
      },
      () => {
        setLocationStatus("GPS was not added. Move the map to set the spot manually.")
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    )
  }, [fillEnvironmentFromCoordinates, fillLocationNameFromCoordinates])

  useEffect(() => {
    if (showForm && editingCatchId === null && !attemptedAutomaticLocation.current) {
      attemptedAutomaticLocation.current = true
      requestCurrentLocation()
    }
  }, [editingCatchId, requestCurrentLocation, showForm])

  function fieldVisible(group: CatchFieldGroup, field: CatchField) {
    return (groups[group.key] ?? true) && (fields[fieldId(group.key, field.key)] ?? true)
  }

  function resetForm() {
    setShowForm(false)
    setEditingCatchId(null)
    setFormValues(emptyForm())
    setFishPhotos([])
    setFormLocation(null)
    setEnvironmentStatus("")
    setLocationStatus("")
    attemptedAutomaticLocation.current = false
  }

  function setValue(groupKey: string, fieldKey: string, value: string) {
    setFormValues((current) => ({ ...current, [fieldId(groupKey, fieldKey)]: value }))
  }

  function getFieldLabel(group: CatchFieldGroup, field: CatchField) {
    if (group.key === "circumstances" && field.key === "depthFished") {
      return `${field.label} (${depthUnit})`
    }

    return field.label
  }

  function formatDetailValue(group: CatchFieldGroup, field: CatchField, value: string) {
    if (
      group.key === "circumstances" &&
      field.key === "depthFished" &&
      value &&
      !valueAlreadyHasDepthUnit(value)
    ) {
      return `${value} ${depthUnit}`
    }

    return value
  }

  function startEditingCatch(fish: CatchRecord) {
    const values = formFromCatch(fish)

    if (fish.length !== null && lengthUnit === "in") {
      values["header.length"] = cleanInputNumber(centimetersToInches(fish.length))
    }

    if (fish.weight !== null && weightUnit === "lb-oz") {
      const { pounds, ounces } = kilogramsToPoundsOunces(fish.weight)
      values["header.weight"] = String(pounds)
      values["header.weightOunces"] = String(ounces)
    }

    setEditingCatchId(fish.id)
    setFormValues(values)
    setFishPhotos(getCatchPhotos(fish))
    setFormLocation(
      fish.latitude === null || fish.longitude === null
        ? null
        : { latitude: fish.latitude, longitude: fish.longitude }
    )
    setLocationStatus(
      fish.latitude === null || fish.longitude === null
        ? "No saved location yet. Move the map and tap Use This Location."
        : "Move the map to update this catch location."
    )
    setEnvironmentStatus("")
    attemptedAutomaticLocation.current = true
    setGalleryCatchId(null)
    setShowForm(true)
  }

  function beginNewCatch() {
    setFormValues(emptyForm())
    setFishPhotos([])
    setEditingCatchId(null)
    setFormLocation(null)
    setEnvironmentStatus("")
    setLocationStatus("")
    attemptedAutomaticLocation.current = false
    setShowForm(true)
  }

  function buildCatch(id: number): CatchRecord {
    const enteredDate = formValues["header.dateTime"]
    const parsedDate = enteredDate ? new Date(enteredDate) : new Date()
    const dateTime = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString()
    const details = detailsFromForm(formValues)
    const lengthValue = formValues["header.length"]
    const weightValue = formValues["header.weight"]
    const ouncesValue = formValues["header.weightOunces"]
    const length =
      lengthValue === ""
        ? null
        : lengthUnit === "in"
          ? inchesToCentimeters(Number(lengthValue))
          : Number(lengthValue)
    const weight =
      weightValue === ""
        ? null
        : weightUnit === "lb-oz"
          ? poundsOuncesToKilograms(Number(weightValue), Number(ouncesValue || 0))
          : Number(weightValue)

    return {
      id,
      dateTime,
      latitude: formLocation?.latitude ?? null,
      longitude: formLocation?.longitude ?? null,
      species: formValues["header.species"]?.trim() ?? "",
      length,
      weight,
      locationName: formValues["header.locationName"]?.trim() || undefined,
      notes: details.journal?.catchNotes ?? "",
      photoDataUrl: fishPhotos[0] || undefined,
      photoDataUrls: fishPhotos.length > 0 ? fishPhotos : undefined,
      details,
    }
  }

  function saveCatch() {
    if (editingCatchId !== null) {
      setCatches((current) => current.map((fish) => fish.id === editingCatchId ? buildCatch(fish.id) : fish))
      setSelectedCatchId(editingCatchId)
      resetForm()
      return
    }

    const newCatch = buildCatch(Date.now())
    setCatches((current) => [...current, newCatch])
    setSelectedCatchId(newCatch.id)
    resetForm()
  }

  function deleteCatch(catchId: number) {
    if (window.confirm("Are you sure you want to delete this catch?")) {
      setCatches((current) => current.filter((fish) => fish.id !== catchId))
      setSelectedCatchId(null)
      setGalleryCatchId(null)
    }
  }

  function addFishPhoto(photo: string) {
    setFishPhotos((current) => [...current, photo])
  }

  function reorderPhotos(photos: string[], fromIndex: number, toIndex: number) {
    const nextPhotos = [...photos]
    const [movedPhoto] = nextPhotos.splice(fromIndex, 1)
    nextPhotos.splice(toIndex, 0, movedPhoto)
    return nextPhotos
  }

  function updateCatchPhotos(catchId: number, photos: string[]) {
    setCatches((current) =>
      current.map((fish) =>
        fish.id === catchId ? withCatchPhotos(fish, photos) : fish
      )
    )
  }

  function renderPhotoGrid(
    photos: string[],
    onPhotosChange: (photos: string[]) => void
  ) {
    return (
      <div className="multi-photo-grid">
        {photos.map((photo, index) => (
          <div
            key={`${photo.slice(0, 32)}-${index}`}
            className="multi-photo-item"
            draggable
            onDragStart={() => setDraggedPhotoIndex(index)}
            onDragEnd={() => setDraggedPhotoIndex(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedPhotoIndex === null || draggedPhotoIndex === index) return
              onPhotosChange(reorderPhotos(photos, draggedPhotoIndex, index))
              setDraggedPhotoIndex(null)
            }}
          >
            <img src={photo} alt={index === 0 ? "Main catch" : `Catch ${index + 1}`} />
            {index === 0 && <span className="main-photo-badge">Main</span>}
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() =>
                onPhotosChange(photos.filter((_, photoIndex) => photoIndex !== index))
              }
            >
              -
            </button>
          </div>
        ))}
      </div>
    )
  }

  function renderFishPhotoManager() {
    return (
      <div className="photo-picker">
        <p className="photo-picker-label">Fish photos</p>
        {fishPhotos.length > 0 && renderPhotoGrid(fishPhotos, setFishPhotos)}
        <div className="photo-action-row">
          <PhotoAddMenu onPhotoAdd={addFishPhoto} />
          {fishPhotos.length > 0 && (
            <button className="danger-button" type="button" onClick={() => setFishPhotos([])}>
              Remove All
            </button>
          )}
        </div>
      </div>
    )
  }

  function renderPressureTrendBreakdown(
    value: string,
    key = "pressure-trend-breakdown",
    defaultTrendValue = ""
  ) {
    const defaultTrendHours = getPressureTrendHours(defaultTrendValue)
    const trendValues = value
      .split("\n")
      .map((trend) => trend.trim())
      .filter((trend) => trend && getPressureTrendHours(trend) !== defaultTrendHours)

    return (
      <details key={key} className="pressure-trend-breakdown">
        <summary><strong>Pressure trend details</strong></summary>
        <div>
          {trendValues.length > 0 ? (
            trendValues.map((trend) => <p key={trend}>{trend}</p>)
          ) : (
            <p>No automatic pressure trend details yet.</p>
          )}
        </div>
      </details>
    )
  }

  function renderInput(group: CatchFieldGroup, field: CatchField) {
    if (!fieldVisible(group, field)) return null
    const value = formValues[fieldId(group.key, field.key)] ?? ""

    if (group.key === "header" && field.key === "length") {
      return (
        <label key={field.key}>
          Length ({lengthUnit})<br />
          <input
            type="number"
            min="0"
            step="any"
            value={value}
            onChange={(event) => setValue(group.key, field.key, event.target.value)}
          />
        </label>
      )
    }

    if (group.key === "header" && field.key === "weight") {
      if (weightUnit === "lb-oz") {
        return (
          <div key={field.key} className="split-input-row">
            <label>
              Weight (lb)<br />
              <input
                type="number"
                min="0"
                step="1"
                value={value}
                onChange={(event) => setValue(group.key, field.key, event.target.value)}
              />
            </label>
            <label>
              Ounces<br />
              <input
                type="number"
                min="0"
                max="15"
                step="1"
                value={formValues["header.weightOunces"] ?? ""}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    "header.weightOunces": event.target.value,
                  }))
                }
              />
            </label>
          </div>
        )
      }

      return (
        <label key={field.key}>
          Weight (kg)<br />
          <input
            type="number"
            min="0"
            step="any"
            value={value}
            onChange={(event) => setValue(group.key, field.key, event.target.value)}
          />
        </label>
      )
    }

    if (group.key === "header" && field.key === "fishPhoto") {
      return <div key={field.key}>{renderFishPhotoManager()}</div>
    }

    if (field.key === "photo") {
      return (
        <PhotoPicker
          key={field.key}
          label={field.label}
          photo={value}
          onPhotoChange={(photo) => setValue(group.key, field.key, photo)}
        />
      )
    }

    if (group.key === "weather" && field.key === "pressureTrendBreakdown") {
      return renderPressureTrendBreakdown(value, field.key, formValues["weather.pressureTrend"])
    }

    return (
      <label key={field.key}>
        {getFieldLabel(group, field)}<br />
        {field.type === "textarea" ? (
          <textarea value={value} onChange={(event) => setValue(group.key, field.key, event.target.value)} />
        ) : (
          <input type={field.type ?? "text"} value={value} onChange={(event) => setValue(group.key, field.key, event.target.value)} />
        )}
      </label>
    )
  }

  function renderLocationEditor() {
    const latitude = formLocation?.latitude ?? DEFAULT_LOCATION.latitude
    const longitude = formLocation?.longitude ?? DEFAULT_LOCATION.longitude

    return (
      <details open className="catch-detail-section">
        <summary><strong>Location</strong></summary>
        <div className="location-editor">
          <p className="page-note">
            {locationStatus || "Move the map and tap Use This Location to save the catch spot."}
          </p>
          <div className="location-button-row">
            <button className="ghost-button" type="button" onClick={requestCurrentLocation}>
              Use current location
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={() => {
                setFormLocation(null)
                setValue("header", "locationName", "")
                setLocationStatus("Location cleared. Move the map to set a new spot.")
              }}
            >
              Clear
            </button>
          </div>
          <CatchMap
            key={`${latitude}:${longitude}:${formLocation === null ? "unsaved" : "saved"}`}
            latitude={latitude}
            longitude={longitude}
            onLocationChange={(newLatitude, newLongitude) => {
              setFormLocation({ latitude: newLatitude, longitude: newLongitude })
              setLocationStatus("Location set from the map. Updating location name...")
              void fillLocationNameFromCoordinates(newLatitude, newLongitude, true)
              void fillEnvironmentFromCoordinates(newLatitude, newLongitude, false)
            }}
            height={260}
            hasSavedLocation={formLocation !== null}
          />
        </div>
      </details>
    )
  }

  function renderFormGroup(group: CatchFieldGroup) {
    if (!(groups[group.key] ?? true)) return null
    const visibleFields = group.fields.filter((field) => fieldVisible(group, field))
    if (visibleFields.length === 0) return null
    return (
      <details key={group.key} open={group.key === "header"} className="catch-detail-section">
        <summary><strong>{group.label}</strong>{group.automatic ? " (automatic data)" : ""}</summary>
        <div className="catch-form-grid">
          {visibleFields.map((field) => renderInput(group, field))}
        </div>
      </details>
    )
  }

  function displayGroup(fish: CatchRecord, group: CatchFieldGroup) {
    if (!(groups[group.key] ?? true) || group.key === "header") return null
    const values = fish.details?.[group.key] ?? {}
    const visibleValues = group.fields.filter((field) => fieldVisible(group, field) && values[field.key])
    if (visibleValues.length === 0) return null
    return (
      <details key={group.key} open className="catch-detail-section">
        <summary><strong>{group.label}</strong></summary>
        <div className="detail-grid">
          {visibleValues.map((field) => field.key === "photo" ? (
            <img key={field.key} src={values[field.key]} alt={field.label} className="detail-photo" />
          ) : group.key === "weather" && field.key === "pressureTrendBreakdown" ? (
            renderPressureTrendBreakdown(values[field.key], field.key, values.pressureTrend)
          ) : (
            <p key={field.key}>
              <strong>{getFieldLabel(group, field)}</strong>
              <span>{formatDetailValue(group, field, values[field.key])}</span>
            </p>
          ))}
        </div>
      </details>
    )
  }

  if (showForm) {
    return (
      <main className="app-page">
        <header className="log-screen-bar">
          <button className="topbar-button" onClick={resetForm}>Back</button>
          <h1>{editingCatchId === null ? "Record Catch" : "Edit Catch"}</h1>
          <button className="topbar-button" onClick={saveCatch}>
            Save
          </button>
        </header>
        <p className="page-note">Automatic data fills from the catch location when available. Water and tide fields can be added as we connect those data services.</p>
        {catchFieldGroups.filter((group) => group.section === "header").map(renderFormGroup)}
        {renderLocationEditor()}
        <h2 className="section-heading">Catch Environment</h2>
        {environmentStatus && <p className="page-note">{environmentStatus}</p>}
        {catchFieldGroups.filter((group) => group.section === "environment").map(renderFormGroup)}
        <h2 className="section-heading">Catch Information</h2>
        {catchFieldGroups.filter((group) => group.section === "information").map(renderFormGroup)}
        {catchFieldGroups.filter((group) => group.section === "journal").map(renderFormGroup)}
        <div className="form-actions">
          <button className="primary-button" onClick={saveCatch}>{editingCatchId === null ? "Save Catch" : "Save Changes"}</button>
          <button className="ghost-button" onClick={resetForm}>Cancel</button>
        </div>
      </main>
    )
  }

  if (galleryCatch !== null) {
    const photos = getCatchPhotos(galleryCatch)

    return (
      <main className="app-page catch-gallery-page">
        <header className="log-screen-bar">
          <button className="topbar-button" onClick={() => setGalleryCatchId(null)}>
            Back
          </button>
          <div>
            <h1>Photo Gallery</h1>
            <p>{photos.length} photo{photos.length === 1 ? "" : "s"}</p>
          </div>
          <button className="topbar-button" onClick={() => startEditingCatch(galleryCatch)}>
            Edit
          </button>
        </header>

        <section className="gallery-panel">
          {photos.length === 0 ? (
            <p className="empty-state">No photos saved for this catch yet.</p>
          ) : (
            renderPhotoGrid(photos, (nextPhotos) =>
              updateCatchPhotos(galleryCatch.id, nextPhotos)
            )
          )}

          <PhotoAddMenu
            onPhotoAdd={(photo) => updateCatchPhotos(galleryCatch.id, [...photos, photo])}
          />
        </section>
      </main>
    )
  }

  if (selectedCatch !== null) {
    const selectedPhotos = getCatchPhotos(selectedCatch)
    const mainPhoto = selectedPhotos[0]

    return (
      <main className="app-page catch-log-page">
        <header className="log-screen-bar">
          <button className="topbar-button" onClick={() => setSelectedCatchId(null)}>
            Back
          </button>
          <div>
            <h1>Log Entry</h1>
            <p>{selectedCatch.species || "Unknown species"}</p>
          </div>
          <div className="entry-actions">
            <button className="topbar-button" onClick={() => startEditingCatch(selectedCatch)}>Edit</button>
            <button className="topbar-button danger-topbar-button" onClick={() => deleteCatch(selectedCatch.id)}>Delete</button>
          </div>
        </header>

        <article className="catch-entry-card">
          {mainPhoto && (
            <img
              src={mainPhoto}
              alt={selectedCatch.species || "Recorded catch"}
              className="catch-hero-photo"
              onDoubleClick={() => setGalleryCatchId(selectedCatch.id)}
            />
          )}

          <section className="catch-summary-box">
            {(fields["header.length"] ?? true) && <p><strong>Length</strong><span>{formatLength(selectedCatch.length, lengthUnit)}</span></p>}
            {(fields["header.weight"] ?? true) && <p><strong>Weight</strong><span>{formatWeight(selectedCatch.weight, weightUnit)}</span></p>}
            {(fields["header.locationName"] ?? true) && <p><strong>Location</strong><span>{selectedCatch.locationName || "Not recorded"}</span></p>}
            {(fields["header.dateTime"] ?? true) && <p><strong>Date</strong><span>{new Date(selectedCatch.dateTime).toLocaleString()}</span></p>}
          </section>

          <h3 className="section-heading">Catch Environment</h3>
          {catchFieldGroups.filter((group) => group.section === "environment").map((group) => displayGroup(selectedCatch, group))}
          <h3 className="section-heading">Catch Information</h3>
          {catchFieldGroups.filter((group) => group.section === "information").map((group) => displayGroup(selectedCatch, group))}
          {catchFieldGroups.filter((group) => group.section === "journal").map((group) => displayGroup(selectedCatch, group))}

          <details open className="catch-detail-section location-section">
            <summary><strong>Location</strong></summary>
            {selectedCatch.latitude === null || selectedCatch.longitude === null ? (
              <p className="location-missing-note">No saved location yet. Tap Edit to set the catch spot.</p>
            ) : (
              <CatchMap
                key={`${selectedCatch.id}:${selectedCatch.latitude}:${selectedCatch.longitude}`}
                latitude={selectedCatch.latitude}
                longitude={selectedCatch.longitude}
                height={260}
                hasSavedLocation
              />
            )}
          </details>
        </article>
      </main>
    )
  }

  return (
    <main className="app-page catch-log-page">
      <header className="page-topbar">
        <button className="ghost-button" onClick={onBackHome}>Back</button>
        <h1>My Catches</h1>
        <button className="primary-button" onClick={beginNewCatch}>Record</button>
      </header>

      {catches.length === 0 ? (
        <p className="empty-state">No catches recorded yet.</p>
      ) : (
        <div className="catch-list">
          {catches.map((fish) => (
            <button
              key={fish.id}
              type="button"
              className="catch-list-item"
              onClick={() => setSelectedCatchId(fish.id)}
            >
              {getCatchPhotos(fish)[0] ? (
                <img src={getCatchPhotos(fish)[0]} alt={fish.species || "Recorded catch"} />
              ) : (
                <span className="catch-list-placeholder">No photo</span>
              )}
              <span className="catch-list-copy">
                <strong>{formatLength(fish.length, lengthUnit)}</strong>
                <span>{formatWeight(fish.weight, weightUnit)}</span>
                <span>{fish.locationName || "Location not recorded"}</span>
                <span>{new Date(fish.dateTime).toLocaleString()}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </main>
  )
}

export default Catches
