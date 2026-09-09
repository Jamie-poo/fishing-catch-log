import { useEffect, useMemo, useRef, useState } from "react"
import PhotoAddMenu from "../../components/PhotoAddMenu"
import { getAutomaticEnvironmentData } from "../../data/environmentData"
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
import { useCatchLogSettings } from "../../data/useCatchLogSettings"

type FieldNotesProps = {
  onBackHome: () => void
  initialSelectedNoteId?: number | null
  onInitialSelectedNoteHandled?: () => void
}

type ConditionDraft = { label: string; value: string }

function formatCreatedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Date not recorded"
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")

  return `${day}/${month}/${year}, ${hour}:${minute}`
}

function formatDateTimeInput(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""

  const timezoneOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

function dateTimeInputToIso(value: string, fallback: string) {
  if (!value) return fallback

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString()
}

function parseCoordinateInput(value: string, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatCoordinates(item: SavedMapItem) {
  return `${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}`
}

function FieldNotes({
  onBackHome,
  initialSelectedNoteId = null,
  onInitialSelectedNoteHandled,
}: FieldNotesProps) {
  const {
    fieldNoteCapturedConditions,
    fieldNoteConditions,
    pressureTrendHours,
  } = useCatchLogSettings()
  const [items, setItems] = useState<SavedMapItem[]>(loadMapItems)
  const [selectedItemId, setSelectedItemId] = useState<number | null>(
    initialSelectedNoteId
  )
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [galleryItemId, setGalleryItemId] = useState<number | null>(null)
  const [title, setTitle] = useState("")
  const [note, setNote] = useState("")
  const [createdAtInput, setCreatedAtInput] = useState("")
  const [latitudeInput, setLatitudeInput] = useState("")
  const [longitudeInput, setLongitudeInput] = useState("")
  const [conditionDrafts, setConditionDrafts] = useState<ConditionDraft[]>([])
  const [photos, setPhotos] = useState<string[]>([])
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState<number | null>(null)
  const [currentConditions, setCurrentConditions] = useState<{
    itemId: number | null
    status: string
    values: Record<string, string>
  }>({ itemId: null, status: "", values: {} })
  const lastPhotoTap = useRef<{ id: number; time: number } | null>(null)

  const visibleItems = useMemo(
    () => items.filter((item) => !isLegacyWaypointForFieldNote(item, items)),
    [items]
  )
  const selectedItem =
    selectedItemId === null
      ? null
      : visibleItems.find((item) => item.id === selectedItemId) ?? null
  const editingItem =
    editingItemId === null
      ? null
      : visibleItems.find((item) => item.id === editingItemId) ?? null
  const galleryItem =
    galleryItemId === null
      ? null
      : visibleItems.find((item) => item.id === galleryItemId) ?? null
  const currentConditionStatus = selectedItem
    ? currentConditions.itemId === selectedItem.id
      ? currentConditions.status
      : "Loading current conditions..."
    : ""
  const currentConditionRows = useMemo(
    () => {
      const values =
        selectedItem && currentConditions.itemId === selectedItem.id
          ? currentConditions.values
          : {}

      return mapWeatherOptions
        .filter((condition) => fieldNoteConditions[condition.key] ?? true)
        .map((condition) => ({
          label: condition.label,
          value: values[condition.key] || "-",
        }))
    },
    [currentConditions, fieldNoteConditions, selectedItem]
  )

  useEffect(() => {
    if (initialSelectedNoteId === null) return

    onInitialSelectedNoteHandled?.()
  }, [initialSelectedNoteId, onInitialSelectedNoteHandled])

  useEffect(() => {
    let isMounted = true

    loadStoredMapItems()
      .then((storedItems) => {
        if (!isMounted) return

        setItems((currentItems) => mergeMapItems(storedItems, currentItems))
      })
      .catch((error) => {
        console.warn("Field notes could not be loaded from device storage.", error)
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!selectedItem) return

    let isCurrent = true

    getAutomaticEnvironmentData(
      selectedItem.latitude,
      selectedItem.longitude,
      pressureTrendHours
    )
      .then((values) => {
        if (!isCurrent) return
        setCurrentConditions({
          itemId: selectedItem.id,
          status: "Current conditions",
          values,
        })
      })
      .catch(() => {
        if (!isCurrent) return
        setCurrentConditions({
          itemId: selectedItem.id,
          status: "Current conditions unavailable",
          values: {},
        })
      })

    return () => {
      isCurrent = false
    }
  }, [pressureTrendHours, selectedItem])

  function updateItems(nextItems: SavedMapItem[]) {
    setItems(nextItems)
    saveMapItems(nextItems)
  }

  function startEditing(item: SavedMapItem) {
    setSelectedItemId(item.id)
    setEditingItemId(item.id)
    setGalleryItemId(null)
    setTitle(item.title)
    setNote(item.note)
    setCreatedAtInput(formatDateTimeInput(item.createdAt))
    setLatitudeInput(String(item.latitude))
    setLongitudeInput(String(item.longitude))
    setConditionDrafts(item.conditions ?? [])
    setPhotos(item.photoDataUrls ?? [])
  }

  function closeEditor() {
    if (editingItemId !== null) {
      setSelectedItemId(editingItemId)
    }
    setEditingItemId(null)
    setGalleryItemId(null)
    setTitle("")
    setNote("")
    setCreatedAtInput("")
    setLatitudeInput("")
    setLongitudeInput("")
    setConditionDrafts([])
    setPhotos([])
  }

  function updateConditionDraft(
    index: number,
    key: keyof ConditionDraft,
    value: string
  ) {
    setConditionDrafts((current) =>
      current.map((condition, conditionIndex) =>
        conditionIndex === index ? { ...condition, [key]: value } : condition
      )
    )
  }

  function reorderPhotos(photoList: string[], fromIndex: number, toIndex: number) {
    const nextPhotos = [...photoList]
    const [movedPhoto] = nextPhotos.splice(fromIndex, 1)
    nextPhotos.splice(toIndex, 0, movedPhoto)
    return nextPhotos
  }

  function updateItemPhotos(itemId: number, nextPhotos: string[]) {
    updateItems(
      items.map((item) =>
        item.id === itemId
          ? { ...item, photoDataUrls: nextPhotos.length > 0 ? nextPhotos : undefined }
          : item
      )
    )
  }

  function handlePhotoTap(itemId: number, eventTime: number) {
    const lastTap = lastPhotoTap.current

    if (lastTap?.id === itemId && eventTime - lastTap.time < 420) {
      lastPhotoTap.current = null
      setGalleryItemId(itemId)
      return
    }

    lastPhotoTap.current = { id: itemId, time: eventTime }
  }

  function renderPhotoGrid(
    photoList: string[],
    onPhotosChange: (nextPhotos: string[]) => void
  ) {
    return (
      <div className="multi-photo-grid">
        {photoList.map((photo, index) => (
          <div
            key={`${photo.slice(0, 32)}-${index}`}
            className="multi-photo-item"
            draggable
            onDragStart={() => setDraggedPhotoIndex(index)}
            onDragEnd={() => setDraggedPhotoIndex(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedPhotoIndex === null || draggedPhotoIndex === index) return
              onPhotosChange(reorderPhotos(photoList, draggedPhotoIndex, index))
              setDraggedPhotoIndex(null)
            }}
          >
            <img src={photo} alt={index === 0 ? "Main field note" : `Field note ${index + 1}`} />
            {index === 0 && <span className="main-photo-badge">Main</span>}
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() =>
                onPhotosChange(photoList.filter((_, photoIndex) => photoIndex !== index))
              }
            >
              -
            </button>
          </div>
        ))}
      </div>
    )
  }

  function saveEditedItem() {
    if (!editingItem) return

    const latitude = parseCoordinateInput(latitudeInput, editingItem.latitude)
    const longitude = parseCoordinateInput(longitudeInput, editingItem.longitude)
    const conditions = conditionDrafts
      .map((condition) => ({
        label: condition.label.trim(),
        value: condition.value.trim(),
      }))
      .filter((condition) => condition.label || condition.value)

    updateItems(
      items.map((item) =>
        item.id === editingItem.id
          ? {
              ...item,
              type: "field-note-waypoint",
              category: "Field Note / Pin",
              title: title.trim() || "Field Note / Pin",
              note: note.trim(),
              createdAt: dateTimeInputToIso(createdAtInput, editingItem.createdAt),
              latitude,
              longitude,
              conditions: conditions.length > 0 ? conditions : undefined,
              photoDataUrls: photos.length > 0 ? photos : undefined,
            }
          : item
      )
    )
    closeEditor()
  }

  function deleteItem(itemId: number) {
    if (!window.confirm("Delete this field note / pin?")) return

    updateItems(items.filter((item) => item.id !== itemId))
    if (selectedItemId === itemId) {
      setSelectedItemId(null)
    }
    if (editingItemId === itemId) {
      closeEditor()
    }
  }

  if (editingItem) {
    return (
      <main className="app-page field-notes-page">
        <header className="log-screen-bar">
          <button
            className="topbar-button"
            type="button"
            onClick={(event) => {
              event.preventDefault()
              closeEditor()
            }}
          >
            Back
          </button>
          <h1>Edit Pin</h1>
          <button
            className="topbar-button"
            type="button"
            onClick={(event) => {
              event.preventDefault()
              saveEditedItem()
            }}
          >
            Save
          </button>
        </header>

        <section className="catch-detail-section field-note-editor">
          <label>
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            Note
            <textarea value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <div className="field-note-editor-grid">
            <label>
              Date and time
              <input
                type="datetime-local"
                value={createdAtInput}
                onChange={(event) => setCreatedAtInput(event.target.value)}
              />
            </label>
            <label>
              Latitude
              <input
                type="number"
                step="0.000001"
                value={latitudeInput}
                onChange={(event) => setLatitudeInput(event.target.value)}
              />
            </label>
            <label>
              Longitude
              <input
                type="number"
                step="0.000001"
                value={longitudeInput}
                onChange={(event) => setLongitudeInput(event.target.value)}
              />
            </label>
          </div>
          <details className="field-note-editor-panel">
            <summary>
              <strong>Captured Conditions</strong>
            </summary>
            <div className="field-note-condition-editor">
              {conditionDrafts.map((condition, index) => (
                <div className="field-note-condition-row" key={`${condition.label}-${index}`}>
                  <label>
                    Label
                    <input
                      value={condition.label}
                      onChange={(event) =>
                        updateConditionDraft(index, "label", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Value
                    <input
                      value={condition.value}
                      onChange={(event) =>
                        updateConditionDraft(index, "value", event.target.value)
                      }
                    />
                  </label>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() =>
                      setConditionDrafts((current) =>
                        current.filter((_, conditionIndex) => conditionIndex !== index)
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              {conditionDrafts.length === 0 && (
                <p className="page-note">No captured conditions saved for this note.</p>
              )}
              <button
                className="ghost-button"
                type="button"
                onClick={() =>
                  setConditionDrafts((current) => [...current, { label: "", value: "" }])
                }
              >
                Add condition
              </button>
            </div>
          </details>
          <div className="field-photo-strip">
            <PhotoAddMenu onPhotoAdd={(photo) => setPhotos((current) => [...current, photo].slice(0, 8))} />
            <span>{photos.length} / 8</span>
            {photos.map((photo, index) => (
              <div key={`${photo.slice(0, 32)}-${index}`} className="field-photo-thumb">
                <img src={photo} alt={`Field note ${index + 1}`} />
                <button
                  type="button"
                  onClick={() =>
                    setPhotos((current) =>
                      current.filter((_, photoIndex) => photoIndex !== index)
                    )
                  }
                >
                  -
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
    )
  }

  if (galleryItem) {
    const galleryPhotos = galleryItem.photoDataUrls ?? []

    return (
      <main className="app-page catch-gallery-page field-notes-page">
        <header className="log-screen-bar">
          <button className="topbar-button" onClick={() => setGalleryItemId(null)}>
            Back
          </button>
          <div>
            <h1>Photo Gallery</h1>
            <p>{galleryPhotos.length} photo{galleryPhotos.length === 1 ? "" : "s"}</p>
          </div>
          <button className="topbar-button" onClick={() => startEditing(galleryItem)}>
            Edit
          </button>
        </header>

        <section className="gallery-panel">
          {galleryPhotos.length === 0 ? (
            <p className="empty-state">No photos saved for this pin yet.</p>
          ) : (
            renderPhotoGrid(galleryPhotos, (nextPhotos) =>
              updateItemPhotos(galleryItem.id, nextPhotos)
            )
          )}

          <PhotoAddMenu
            onPhotoAdd={(photo) =>
              updateItemPhotos(galleryItem.id, [...galleryPhotos, photo].slice(0, 8))
            }
          />
        </section>
      </main>
    )
  }

  if (selectedItem) {
    return (
      <main className="app-page field-notes-page">
        <header className="log-screen-bar">
          <button className="topbar-button" onClick={() => setSelectedItemId(null)}>Back</button>
          <div>
            <h1>Field Note / Pin</h1>
            <p>{formatCreatedAt(selectedItem.createdAt)}</p>
          </div>
          <div className="entry-actions">
            <button className="topbar-button" onClick={() => startEditing(selectedItem)}>Edit</button>
            <button
              className="topbar-button danger-topbar-button"
              onClick={() => deleteItem(selectedItem.id)}
            >
              Delete
            </button>
          </div>
        </header>

        <article className="catch-entry-card field-note-detail">
          {selectedItem.photoDataUrls?.[0] && (
            <img
              className="catch-hero-photo"
              src={selectedItem.photoDataUrls[0]}
              alt={selectedItem.title}
              onDoubleClick={() => setGalleryItemId(selectedItem.id)}
              onTouchEnd={(event) => handlePhotoTap(selectedItem.id, event.timeStamp)}
            />
          )}

          <section className="catch-summary-box">
            <p>
              <strong>Title</strong>
              <span>{selectedItem.title}</span>
            </p>
            <p>
              <strong>Type</strong>
              <span>{getMapItemTypeLabel(selectedItem)}</span>
            </p>
            <p>
              <strong>Location</strong>
              <span>{formatCoordinates(selectedItem)}</span>
            </p>
            <p>
              <strong>Date</strong>
              <span>{formatCreatedAt(selectedItem.createdAt)}</span>
            </p>
          </section>

          {selectedItem.note && (
            <section className="catch-detail-section field-note-text-section">
              <h2>Note</h2>
              <p>{selectedItem.note}</p>
            </section>
          )}

          {fieldNoteCapturedConditions &&
            selectedItem.conditions &&
            selectedItem.conditions.length > 0 && (
            <details className="catch-detail-section field-note-conditions">
              <summary>
                <strong>Captured Conditions</strong>
              </summary>
              <div className="detail-grid">
                {selectedItem.conditions.map((condition) => (
                  <p key={condition.label}>
                    <strong>{condition.label}</strong>
                    <span>{condition.value}</span>
                  </p>
                ))}
              </div>
            </details>
          )}

          <details className="catch-detail-section field-note-conditions">
            <summary>
              <strong>Current Conditions</strong>
              {currentConditionStatus && <span>{currentConditionStatus}</span>}
            </summary>
            <div className="detail-grid">
              {currentConditionRows.length > 0 ? (
                currentConditionRows.map((condition) => (
                  <p key={condition.label}>
                    <strong>{condition.label}</strong>
                    <span>{condition.value}</span>
                  </p>
                ))
              ) : (
                <p>
                  <strong>No conditions enabled</strong>
                  <span>Change this in Settings.</span>
                </p>
              )}
            </div>
          </details>

          {selectedItem.photoDataUrls && selectedItem.photoDataUrls.length > 1 && (
            <section className="catch-detail-section field-note-photos-section">
              <h2>Photos</h2>
              <div className="field-note-photo-grid">
                {selectedItem.photoDataUrls.map((photo, index) => (
                  <button
                    key={`${photo.slice(0, 32)}-${index}`}
                    type="button"
                    onClick={() => setGalleryItemId(selectedItem.id)}
                  >
                    <img src={photo} alt={`Field note ${index + 1}`} />
                  </button>
                ))}
              </div>
            </section>
          )}
        </article>
      </main>
    )
  }

  return (
    <main className="app-page field-notes-page">
      <header className="page-topbar">
        <button className="ghost-button" onClick={onBackHome}>Back</button>
        <h1>Field Notes</h1>
        <span />
      </header>

      {visibleItems.length === 0 ? (
        <p className="empty-state">No field notes saved yet.</p>
      ) : (
        <div className="catch-list">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className="catch-list-item field-note-list-item"
              onClick={() => setSelectedItemId(item.id)}
            >
              {item.photoDataUrls?.[0] ? (
                <img src={item.photoDataUrls[0]} alt={item.title} />
              ) : (
                <span className="catch-list-placeholder note-pin-badge">N</span>
              )}
              <span className="catch-list-copy">
                <strong>{item.title || "Field Note / Pin"}</strong>
                <span>{item.note || getMapItemTypeLabel(item)}</span>
                <span>{formatCreatedAt(item.createdAt)}</span>
                <span>{formatCoordinates(item)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </main>
  )
}

export default FieldNotes
