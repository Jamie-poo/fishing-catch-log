import { useMemo, useState } from "react"
import PhotoAddMenu from "../../components/PhotoAddMenu"
import {
  getMapItemTypeLabel,
  isLegacyWaypointForFieldNote,
  loadMapItems,
  saveMapItems,
  type SavedMapItem,
} from "../../data/mapItems"

type FieldNotesProps = {
  onBackHome: () => void
}

function formatCreatedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Date not recorded"
  return date.toLocaleString()
}

function formatCoordinates(item: SavedMapItem) {
  return `${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}`
}

function FieldNotes({ onBackHome }: FieldNotesProps) {
  const [items, setItems] = useState<SavedMapItem[]>(loadMapItems)
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null)
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [title, setTitle] = useState("")
  const [note, setNote] = useState("")
  const [photos, setPhotos] = useState<string[]>([])

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

  function updateItems(nextItems: SavedMapItem[]) {
    setItems(nextItems)
    saveMapItems(nextItems)
  }

  function startEditing(item: SavedMapItem) {
    setEditingItemId(item.id)
    setTitle(item.title)
    setNote(item.note)
    setPhotos(item.photoDataUrls ?? [])
  }

  function closeEditor() {
    setEditingItemId(null)
    setTitle("")
    setNote("")
    setPhotos([])
  }

  function saveEditedItem() {
    if (!editingItem) return

    updateItems(
      items.map((item) =>
        item.id === editingItem.id
          ? {
              ...item,
              type: "field-note-waypoint",
              category: "Field Note / Pin",
              title: title.trim() || "Field Note / Pin",
              note: note.trim(),
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
          <button className="topbar-button" onClick={closeEditor}>Back</button>
          <h1>Edit Pin</h1>
          <button className="topbar-button" onClick={saveEditedItem}>Save</button>
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
          <p className="field-note-coordinates">{formatCoordinates(editingItem)}</p>
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
            <section className="catch-detail-section">
              <h2>Note</h2>
              <p>{selectedItem.note}</p>
            </section>
          )}

          {selectedItem.conditions && selectedItem.conditions.length > 0 && (
            <section className="catch-detail-section">
              <h2>Captured Conditions</h2>
              <div className="detail-grid">
                {selectedItem.conditions.map((condition) => (
                  <p key={condition.label}>
                    <strong>{condition.label}</strong>
                    <span>{condition.value}</span>
                  </p>
                ))}
              </div>
            </section>
          )}

          {selectedItem.photoDataUrls && selectedItem.photoDataUrls.length > 1 && (
            <section className="catch-detail-section">
              <h2>Photos</h2>
              <div className="field-note-photo-grid">
                {selectedItem.photoDataUrls.map((photo, index) => (
                  <img key={`${photo.slice(0, 32)}-${index}`} src={photo} alt={`Field note ${index + 1}`} />
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
