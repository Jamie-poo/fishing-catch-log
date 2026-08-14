import type { CatchRecord } from "../../data/catchData"
import { getCatchPhotos } from "../../data/catchPhotos"
import { formatLength, formatWeight } from "../../data/measurements"
import { useCatchLogSettings } from "../../data/useCatchLogSettings"
import { useCatches } from "../../data/useCatches"

type RecordsProps = {
  onBackHome: () => void
}

function findLongestCatch(catches: CatchRecord[]) {
  return catches.reduce<CatchRecord | null>((record, fish) => {
    if (fish.length === null) return record
    if (record === null || fish.length > (record.length ?? -1)) return fish
    return record
  }, null)
}

function findHeaviestCatch(catches: CatchRecord[]) {
  return catches.reduce<CatchRecord | null>((record, fish) => {
    if (fish.weight === null) return record
    if (record === null || fish.weight > (record.weight ?? -1)) return fish
    return record
  }, null)
}

function RecordCard({
  fish,
  label,
  value,
}: {
  fish: CatchRecord | null
  label: string
  value: string
}) {
  return (
    <article className="record-card">
      <div>
        <p>{label}</p>
        <h2>{value}</h2>
      </div>

      {fish === null ? (
        <p className="page-note">No record yet.</p>
      ) : (
        <div className="record-card-body">
          {getCatchPhotos(fish)[0] ? (
            <img src={getCatchPhotos(fish)[0]} alt={fish.species || label} />
          ) : (
            <span className="catch-list-placeholder">No photo</span>
          )}
          <div>
            <strong>{fish.species || "Unknown species"}</strong>
            <span>{new Date(fish.dateTime).toLocaleString()}</span>
            <span>{fish.locationName || "Location not recorded"}</span>
          </div>
        </div>
      )}
    </article>
  )
}

function Records({ onBackHome }: RecordsProps) {
  const { catches } = useCatches()
  const { lengthUnit, weightUnit } = useCatchLogSettings()
  const longestCatch = findLongestCatch(catches)
  const heaviestCatch = findHeaviestCatch(catches)

  return (
    <main className="app-page records-page">
      <header className="page-topbar">
        <button className="ghost-button" onClick={onBackHome}>Back</button>
        <h1>My Records</h1>
      </header>

      {catches.length === 0 ? (
        <p className="empty-state">Record some catches to see your personal bests.</p>
      ) : (
        <div className="records-list">
          <RecordCard
            fish={longestCatch}
            label="Longest Catch"
            value={formatLength(longestCatch?.length ?? null, lengthUnit)}
          />
          <RecordCard
            fish={heaviestCatch}
            label="Heaviest Catch"
            value={formatWeight(heaviestCatch?.weight ?? null, weightUnit)}
          />
        </div>
      )}
    </main>
  )
}

export default Records
