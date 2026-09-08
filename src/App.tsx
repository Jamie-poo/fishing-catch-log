import { useState } from "react"
import Home from "./pages/Home/Home"
import Catches from "./pages/Catches/Catches"
import Stats from "./pages/Stats/Stats"
import CatchMap from "./pages/CatchMap/CatchMap"
import { CatchesProvider } from "./data/CatchesProvider"
import { CatchLogSettingsProvider } from "./data/CatchLogSettingsProvider"
import Records from "./pages/Records/Records"
import Settings from "./pages/Settings/Settings"
import FieldNotes from "./pages/FieldNotes/FieldNotes"

function App() {
  const [currentPage, setCurrentPage] = useState("home")
  const [catchToOpen, setCatchToOpen] = useState<number | null>(null)

  let page = null

  if (currentPage === "home") {
    page = (
      <Home
        onOpenCatches={() => setCurrentPage("catches")}
        onOpenCatchDetail={(catchId) => {
          setCatchToOpen(catchId)
          setCurrentPage("catches")
        }}
        onOpenStats={() => setCurrentPage("stats")}
        onOpenCatchMap={() => setCurrentPage("catch-map")}
        onOpenRecords={() => setCurrentPage("records")}
        onOpenFieldNotes={() => setCurrentPage("field-notes")}
        onOpenSettings={() => setCurrentPage("settings")}
        onRecordCatch={() => setCurrentPage("record-catch")}
      />
    )
  }

  if (currentPage === "catches") {
    page = (
      <Catches
        onBackHome={() => setCurrentPage("home")}
        initialSelectedCatchId={catchToOpen}
        onInitialSelectedCatchHandled={() => setCatchToOpen(null)}
      />
    )
  }

  if (currentPage === "record-catch") {
    page = (
      <Catches
        onBackHome={() => setCurrentPage("home")}
        startInRecordMode
      />
    )
  }

  if (currentPage === "stats") {
    page = (
      <Stats
        onBackHome={() => setCurrentPage("home")}
      />
    )
  }

  if (currentPage === "catch-map") {
    page = (
      <CatchMap
        onBackHome={() => setCurrentPage("home")}
      />
    )
  }

  if (currentPage === "records") {
    page = (
     <Records
      onBackHome={() => setCurrentPage("home")}
     />
    )
  }

  if (currentPage === "field-notes") {
    page = (
      <FieldNotes
        onBackHome={() => setCurrentPage("home")}
      />
    )
  }

  if (currentPage === "settings") {
    page = (
      <Settings
        onBackHome={() => setCurrentPage("home")}
      />
    )
  }

  return (
    <CatchLogSettingsProvider>
      <CatchesProvider>{page}</CatchesProvider>
    </CatchLogSettingsProvider>
  )
}

export default App
