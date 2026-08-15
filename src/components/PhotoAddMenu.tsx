import { useId } from "react"

type PhotoAddMenuProps = {
  onPhotoAdd: (photo: string) => void
}

const MAX_PHOTO_SIZE = 1600
const PHOTO_QUALITY = 0.82

function readPhotoAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
        return
      }

      reject(new Error("Photo could not be read"))
    })
    reader.addEventListener("error", () => reject(reader.error))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.addEventListener("load", () => resolve(image))
    image.addEventListener("error", () => reject(new Error("Photo could not be loaded")))
    image.src = src
  })
}

function canvasToDataUrl(canvas: HTMLCanvasElement) {
  return new Promise<string>((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(canvas.toDataURL("image/jpeg", PHOTO_QUALITY))
          return
        }

        const reader = new FileReader()
        reader.addEventListener("load", () => {
          resolve(typeof reader.result === "string" ? reader.result : "")
        })
        reader.readAsDataURL(blob)
      },
      "image/jpeg",
      PHOTO_QUALITY
    )
  })
}

async function preparePhoto(file: File) {
  const source = await readPhotoAsDataUrl(file)
  const image = await loadImage(source)
  const scale = Math.min(1, MAX_PHOTO_SIZE / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")

  if (!context) return source

  context.drawImage(image, 0, 0, width, height)
  return canvasToDataUrl(canvas)
}

function PhotoAddMenu({ onPhotoAdd }: PhotoAddMenuProps) {
  const photoInputId = useId()

  async function importPhotos(files: FileList | null) {
    if (!files) return

    for (const file of Array.from(files)) {
      try {
        onPhotoAdd(await preparePhoto(file))
      } catch {
        onPhotoAdd(await readPhotoAsDataUrl(file))
      }
    }
  }

  return (
    <div className="photo-add-menu">
      <label className="ghost-button file-button" htmlFor={photoInputId}>
        Add Photo
      </label>
      <input
        id={photoInputId}
        className="visually-hidden"
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => {
          void importPhotos(event.target.files)
          event.target.value = ""
        }}
      />
    </div>
  )
}

export default PhotoAddMenu
