import { formatLength, formatWeight } from "../../data/measurements"
import { useCatchLogSettings } from "../../data/useCatchLogSettings"
import { useCatches } from "../../data/useCatches"

type StatsProps = {
  onBackHome: () => void
}

function Stats({ onBackHome }: StatsProps) {
  const { catches } = useCatches()
  const { lengthUnit, weightUnit } = useCatchLogSettings()

  const measuredLengths = catches
    .map((fish) => fish.length)
    .filter((length): length is number => length !== null)
  const measuredWeights = catches
    .map((fish) => fish.weight)
    .filter((weight): weight is number => weight !== null)

  const averageLength =
    measuredLengths.length === 0
      ? null
      : measuredLengths.reduce((total, length) => total + length, 0) /
        measuredLengths.length
  const averageWeight =
    measuredWeights.length === 0
      ? null
      : measuredWeights.reduce((total, weight) => total + weight, 0) /
        measuredWeights.length
  const longestCatch =
    measuredLengths.length === 0 ? null : Math.max(...measuredLengths)
  const heaviestCatch =
    measuredWeights.length === 0 ? null : Math.max(...measuredWeights)

  const speciesCounts = catches.reduce<Record<string, number>>(
    (counts, fish) => {
      const species = fish.species.trim() || "Unknown species"
      counts[species] = (counts[species] || 0) + 1
      return counts
    },
    {}
  )

  const speciesBreakdown = Object.entries(speciesCounts).sort(
    ([, firstCount], [, secondCount]) => secondCount - firstCount
  )

  return (
    <main className="app-page stats-page">
      <header className="page-topbar">
        <button className="ghost-button" onClick={onBackHome}>Back</button>
        <h1>My Stats</h1>
      </header>

      {catches.length === 0 ? (
        <p className="empty-state">Record some catches to see your statistics.</p>
      ) : (
        <>
          <section className="stats-grid">
            <article className="stat-card">
              <span>Total Catches</span>
              <strong>{catches.length}</strong>
            </article>
            <article className="stat-card">
              <span>Species</span>
              <strong>{speciesBreakdown.length}</strong>
            </article>
            <article className="stat-card">
              <span>Longest</span>
              <strong>{formatLength(longestCatch, lengthUnit)}</strong>
            </article>
            <article className="stat-card">
              <span>Heaviest</span>
              <strong>{formatWeight(heaviestCatch, weightUnit)}</strong>
            </article>
          </section>

          <details open className="catch-detail-section">
            <summary><strong>Averages</strong></summary>
            <div className="detail-grid">
              <p>
                <strong>Average length</strong>
                <span>{formatLength(averageLength, lengthUnit)}</span>
              </p>
              <p>
                <strong>Average weight</strong>
                <span>{formatWeight(averageWeight, weightUnit)}</span>
              </p>
            </div>
          </details>

          <details open className="catch-detail-section">
            <summary><strong>Catches by Species</strong></summary>
            <div className="stat-list">
              {speciesBreakdown.map(([species, count]) => (
                <p key={species}>
                  <strong>{species}</strong>
                  <span>{count}</span>
                </p>
              ))}
            </div>
          </details>
        </>
      )}
    </main>
  )
}

export default Stats
