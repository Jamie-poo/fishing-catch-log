import { useEffect, useState } from "react"
import { catchFieldGroups, fieldId } from "../../data/catchStructure"
import type { DepthUnit, LengthUnit, PressureTrendHours, WeightUnit } from "../../data/catchLogSettingsContext"
import { homeMapControlOptions } from "../../data/homeMapControls"
import { homeMapDisplayOptions } from "../../data/homeMapDisplay"
import { homeSearchOptions } from "../../data/homeSearch"
import { homeSummaryOptions } from "../../data/homeSummary"
import { mapFilterOptions } from "../../data/mapFilters"
import { mapWeatherOptions } from "../../data/mapWeather"
import { applyThemePreference, getSavedTheme, type ThemePreference } from "../../data/theme"
import { useCatchLogSettings } from "../../data/useCatchLogSettings"

type SettingsProps = { onBackHome: () => void }

function Settings({ onBackHome }: SettingsProps) {
  const [theme, setTheme] = useState<ThemePreference>(getSavedTheme)
  const {
    groups,
    fields,
    depthUnit,
    fieldNoteCapturedConditions,
    fieldNoteConditions,
    homeMapControls,
    homeMapDisplay,
    homeSearch,
    homeSummary,
    lengthUnit,
    mapFilters,
    mapWeatherConditions,
    pressureTrendHours,
    weightUnit,
    setDepthUnit,
    setFieldNoteCapturedConditionsVisible,
    setGroupVisible,
    setFieldVisible,
    setFieldNoteConditionVisible,
    setHomeMapControlVisible,
    setHomeMapDisplayVisible,
    setHomeSearchVisible,
    setHomeSummaryVisible,
    setLengthUnit,
    setMapFilterVisible,
    setMapWeatherConditionVisible,
    setPressureTrendHours,
    setWeightUnit,
  } = useCatchLogSettings()

  useEffect(() => {
    applyThemePreference(theme)
  }, [theme])

  return (
    <main className="app-page settings-page">
      <header className="page-topbar settings-topbar">
        <button className="ghost-button" type="button" onClick={onBackHome}>Home</button>
        <h1>Settings</h1>
        <span aria-hidden="true" />
      </header>

      <details open className="catch-detail-section">
        <summary><strong>Appearance</strong></summary>
        <div className="catch-form-grid">
          <label>
            Theme<br />
            <select value={theme} onChange={(event) => setTheme(event.target.value as ThemePreference)}>
              <option value="system">Use device setting</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>
      </details>

      <details open className="catch-detail-section">
        <summary><strong>Units of Measurement</strong></summary>
        <div className="catch-form-grid">
          <label>
            Length<br />
            <select
              value={lengthUnit}
              onChange={(event) => setLengthUnit(event.target.value as LengthUnit)}
            >
              <option value="cm">Centimetres (cm)</option>
              <option value="in">Inches (in)</option>
            </select>
          </label>

          <label>
            Weight<br />
            <select
              value={weightUnit}
              onChange={(event) => setWeightUnit(event.target.value as WeightUnit)}
            >
              <option value="kg">Kilograms (kg)</option>
              <option value="lb-oz">Pounds and ounces (lb + oz)</option>
            </select>
          </label>

          <label>
            Depth<br />
            <select
              value={depthUnit}
              onChange={(event) => setDepthUnit(event.target.value as DepthUnit)}
            >
              <option value="m">Metres (m)</option>
              <option value="ft">Feet (ft)</option>
            </select>
          </label>
        </div>
      </details>

      <details open className="catch-detail-section">
        <summary><strong>Automatic Data</strong></summary>
        <div className="catch-form-grid">
          <label>
            Default pressure trend<br />
            <select
              value={pressureTrendHours}
              onChange={(event) => setPressureTrendHours(Number(event.target.value) as PressureTrendHours)}
            >
              <option value={3}>3 hours</option>
              <option value={6}>6 hours</option>
              <option value={12}>12 hours</option>
              <option value={24}>24 hours</option>
              <option value={72}>3 days</option>
            </select>
          </label>

          <label>
            <input
              type="checkbox"
              checked={fields[fieldId("weather", "pressureTrendBreakdown")] ?? true}
              onChange={(event) =>
                setFieldVisible("weather", "pressureTrendBreakdown", event.target.checked)
              }
            /> Show pressure trend details dropdown
          </label>
        </div>
      </details>

      <h2 className="section-heading">Edit Home Map</h2>
      <p className="page-note">Choose what appears on the home map screen.</p>

      <details className="catch-detail-section">
        <summary><strong>Home Summary Card</strong></summary>
        <div className="settings-check-grid">
          {homeSummaryOptions.map((option) => (
            <label key={option.key}>
              <input
                type="checkbox"
                checked={homeSummary[option.key] ?? true}
                onChange={(event) =>
                  setHomeSummaryVisible(option.key, event.target.checked)
                }
              /> {option.label}
            </label>
          ))}
        </div>
      </details>

      <details className="catch-detail-section">
        <summary><strong>Home Map Buttons</strong></summary>
        <div className="settings-check-grid">
          {homeMapControlOptions.map((option) => (
            <label key={option.key}>
              <input
                type="checkbox"
                checked={homeMapControls[option.key] ?? true}
                onChange={(event) =>
                  setHomeMapControlVisible(option.key, event.target.checked)
                }
              /> {option.label}
            </label>
          ))}
        </div>
      </details>

      <details className="catch-detail-section">
        <summary><strong>Home Map Display</strong></summary>
        <div className="settings-check-grid">
          {homeMapDisplayOptions.map((option) => (
            <label key={option.key}>
              <input
                type="checkbox"
                checked={homeMapDisplay[option.key] ?? true}
                onChange={(event) =>
                  setHomeMapDisplayVisible(option.key, event.target.checked)
                }
              /> {option.label}
            </label>
          ))}
        </div>
      </details>

      <details className="catch-detail-section">
        <summary><strong>Home Search</strong></summary>
        <div className="settings-check-grid">
          {homeSearchOptions.map((option) => (
            <label key={option.key}>
              <input
                type="checkbox"
                checked={homeSearch[option.key] ?? true}
                onChange={(event) =>
                  setHomeSearchVisible(option.key, event.target.checked)
                }
              /> {option.label}
            </label>
          ))}
        </div>
      </details>

      <h2 className="section-heading">Edit Field Note / Pin</h2>
      <p className="page-note">Choose how captured and live conditions appear on Field Note / Pin details.</p>

      <details className="catch-detail-section">
        <summary><strong>Captured Conditions Dropdown</strong></summary>
        <div className="settings-check-grid">
          <label>
            <input
              type="checkbox"
              checked={fieldNoteCapturedConditions}
              onChange={(event) =>
                setFieldNoteCapturedConditionsVisible(event.target.checked)
              }
            /> Show Captured Conditions on field notes
          </label>
        </div>
      </details>

      <details className="catch-detail-section">
        <summary><strong>Current Conditions Dropdown</strong></summary>
        <div className="settings-check-grid">
          {mapWeatherOptions.map((condition) => (
            <label key={condition.key}>
              <input
                type="checkbox"
                checked={fieldNoteConditions[condition.key] ?? true}
                onChange={(event) =>
                  setFieldNoteConditionVisible(condition.key, event.target.checked)
                }
              /> {condition.label}
            </label>
          ))}
        </div>
      </details>

      <h2 className="section-heading">Edit Map Weather</h2>
      <p className="page-note">Choose which live weather conditions appear on the Catch Map.</p>

      <details className="catch-detail-section">
        <summary><strong>Map Weather Conditions</strong></summary>
        <div className="settings-check-grid">
          {mapWeatherOptions.map((condition) => (
            <label key={condition.key}>
              <input
                type="checkbox"
                checked={mapWeatherConditions[condition.key] ?? true}
                onChange={(event) =>
                  setMapWeatherConditionVisible(condition.key, event.target.checked)
                }
              /> {condition.label}
            </label>
          ))}
        </div>
      </details>

      <h2 className="section-heading">Edit Map Filters</h2>
      <p className="page-note">Choose which filters appear on the Catch Map.</p>

      <details className="catch-detail-section">
        <summary><strong>Map Filters</strong></summary>
        <div className="settings-check-grid">
          {mapFilterOptions.map((filter) => (
            <label key={filter.key}>
              <input
                type="checkbox"
                checked={mapFilters[filter.key] ?? true}
                onChange={(event) => setMapFilterVisible(filter.key, event.target.checked)}
              /> {filter.label}
            </label>
          ))}
        </div>
      </details>

      <h2 className="section-heading">Edit Catch Log</h2>
      <p className="page-note">Choose which groups and fields appear when you record or view a catch.</p>

      {(["header", "environment", "information", "journal"] as const).map((section) => (
        <details key={section} className="catch-detail-section">
          <summary><strong>{section === "header" ? "Header" : section === "environment" ? "Catch Environment" : section === "information" ? "Catch Information" : "Journal"}</strong></summary>
          {catchFieldGroups.filter((group) => group.section === section).map((group) => (
            <details key={group.key} className="settings-subsection">
              <summary>
                <label>
                  <input
                    type="checkbox"
                    checked={groups[group.key] ?? true}
                    onChange={(event) => setGroupVisible(group.key, event.target.checked)}
                  /> {group.label}{group.automatic ? " (automatic)" : ""}
                </label>
              </summary>
              <div className="settings-check-grid">
                {group.fields.map((field) => (
                  <label key={field.key}>
                    <input
                      type="checkbox"
                      checked={fields[fieldId(group.key, field.key)] ?? true}
                      onChange={(event) => setFieldVisible(group.key, field.key, event.target.checked)}
                    /> {field.label}
                  </label>
                ))}
              </div>
            </details>
          ))}
        </details>
      ))}
    </main>
  )
}

export default Settings
