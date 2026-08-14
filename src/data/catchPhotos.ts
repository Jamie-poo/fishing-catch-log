import type { CatchRecord } from "./catchData"

export function getCatchPhotos(fish: CatchRecord) {
  if (fish.photoDataUrls && fish.photoDataUrls.length > 0) {
    return fish.photoDataUrls
  }

  return fish.photoDataUrl ? [fish.photoDataUrl] : []
}

export function withCatchPhotos(fish: CatchRecord, photos: string[]) {
  return {
    ...fish,
    photoDataUrl: photos[0] || undefined,
    photoDataUrls: photos.length > 0 ? photos : undefined,
  }
}
