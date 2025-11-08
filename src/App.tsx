import { useState } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import MinimalOBD from "./components/MinimalOBD";
import AutelKeyProgramming from "./components/AutelKeyProgramming";

type View = "diagnostics" | "immo";

function App() {
  const [currentView, setCurrentView] = useState<View>("diagnostics");

  return (
    <ErrorBoundary>
      <div style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#1a1a2e'
      }}>
        {/* Navigation Bar */}
        <div style={{
          padding: '20px',
          backgroundColor: '#0f1419',
          borderBottom: '3px solid #00d4ff',
          display: 'flex',
          gap: '20px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setCurrentView("diagnostics")}
            style={{
              padding: '15px 30px',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              backgroundColor: currentView === "diagnostics" ? '#0f4c75' : '#0f3460',
              color: '#fff',
              border: `3px solid ${currentView === "diagnostics" ? '#00d4ff' : '#666'}`,
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            🚗 OBD Diagnostics
          </button>

          <button
            onClick={() => setCurrentView("immo")}
            style={{
              padding: '15px 30px',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              backgroundColor: currentView === "immo" ? '#3d1f0f' : '#0f3460',
              color: '#fff',
              border: `3px solid ${currentView === "immo" ? '#ff6600' : '#666'}`,
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            🔐 Autel IMMO Reference
          </button>
        </div>

        {/* Content */}
        {currentView === "diagnostics" && <MinimalOBD />}
        {currentView === "immo" && <AutelKeyProgramming />}
      </div>
    </ErrorBoundary>
  );
}

export default App;
