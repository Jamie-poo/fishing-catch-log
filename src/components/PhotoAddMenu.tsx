import { useEffect, useId, useRef, useState } from "react"

type PhotoAddMenuProps = {
  onPhotoAdd: (photo: string) => void
}

function readPhoto(file: File | undefined, save: (value: string) => void) {
  if (!file) return
  const reader = new FileReader()
  reader.addEventListener("load", () => {
    if (typeof reader.result === "string") save(reader.result)
  })
  reader.readAsDataURL(file)
}

function PhotoAddMenu({ onPhotoAdd }: PhotoAddMenuProps) {
  const cameraRollInputId = useId()
  const filesInputId = useId()
  const cameraFallbackInputId = useId()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState("")

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraOpen(false)
  }

  async function startCamera() {
    setMenuOpen(false)
    setCameraError("")

    if (!navigator.mediaDevices?.getUserMedia) {
      document.getElementById(cameraFallbackInputId)?.click()
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      })

      streamRef.current = stream
      setCameraOpen(true)
    } catch {
      setCameraError("Camera is not available. You can still import a photo.")
    }
  }

  function capturePhoto() {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext("2d")
    if (!context) return

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    onPhotoAdd(canvas.toDataURL("image/jpeg", 0.9))
    stopCamera()
  }

  function importPhoto(file: File | undefined) {
    readPhoto(file, onPhotoAdd)
    setMenuOpen(false)
  }

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) {
      return
    }

    videoRef.current.srcObject = streamRef.current
    void videoRef.current.play()
  }, [cameraOpen])

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
    },
    []
  )

  return (
    <div className="photo-add-menu">
      <button
        className="ghost-button"
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
      >
        Add Photo
      </button>

      {menuOpen && (
        <div className="photo-menu-panel">
          <button type="button" onClick={startCamera}>
            Take photo
          </button>
          <label htmlFor={cameraRollInputId}>Import from camera roll</label>
          <label htmlFor={filesInputId}>Import from files</label>
        </div>
      )}

      {cameraOpen && (
        <div className="camera-panel">
          <video ref={videoRef} playsInline muted />
          <div className="photo-action-row">
            <button className="primary-button" type="button" onClick={capturePhoto}>
              Use Photo
            </button>
            <button className="ghost-button" type="button" onClick={stopCamera}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {cameraError && <p className="page-note">{cameraError}</p>}

      <input
        id={cameraRollInputId}
        className="visually-hidden"
        type="file"
        accept="image/*"
        onChange={(event) => importPhoto(event.target.files?.[0])}
      />
      <input
        id={filesInputId}
        className="visually-hidden"
        type="file"
        accept="image/*"
        onChange={(event) => importPhoto(event.target.files?.[0])}
      />
      <input
        id={cameraFallbackInputId}
        className="visually-hidden"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => importPhoto(event.target.files?.[0])}
      />
    </div>
  )
}

export default PhotoAddMenu
