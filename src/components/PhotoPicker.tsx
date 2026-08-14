import PhotoAddMenu from "./PhotoAddMenu"

type PhotoPickerProps = {
  label: string
  photo: string
  onPhotoChange: (photo: string) => void
}

function PhotoPicker({ label, photo, onPhotoChange }: PhotoPickerProps) {
  return (
    <div className="photo-picker">
      <p className="photo-picker-label">{label}</p>

      {photo && (
        <img src={photo} alt={label} className="photo-picker-preview" />
      )}

      <div className="photo-action-row">
        <PhotoAddMenu onPhotoAdd={onPhotoChange} />
        {photo && (
          <button className="danger-button" type="button" onClick={() => onPhotoChange("")}>
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

export default PhotoPicker
