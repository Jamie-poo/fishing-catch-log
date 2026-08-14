export function formatCoordinateLocation(latitude: number, longitude: number) {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
}

function locationNameFromAddress(address: Record<string, string>) {
  return (
    address.suburb ||
    address.neighbourhood ||
    address.village ||
    address.town ||
    address.city ||
    address.municipality ||
    address.county ||
    address.state
  )
}

export async function getLocationNameFromCoordinates(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
) {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
    { signal }
  )
  const data = (await response.json()) as {
    address?: Record<string, string>
    name?: string
  }

  return (
    (data.address && locationNameFromAddress(data.address)) ||
    data.name ||
    formatCoordinateLocation(latitude, longitude)
  )
}
