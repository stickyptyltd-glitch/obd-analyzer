import { useState } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import MinimalOBD from "./components/MinimalOBD";
import AutelKeyProgramming from "./components/AutelKeyProgramming";
import AutelAKLProcedures from "./components/AutelAKLProcedures";
import RFSecurityResearch from "./components/RFSecurityResearch";
import LiveOBDMonitor from "./components/LiveOBDMonitor";
import AutomatedAKLInterface from "./components/AutomatedAKLInterface";
import CANBusController from "./components/CANBusController";

type View = "diagnostics" | "immo" | "akl" | "rf_security" | "live_obd" | "automated_akl" | "can_bus";

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
          gap: '15px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setCurrentView("diagnostics")}
            style={{
              padding: '15px 25px',
              fontSize: '1.1rem',
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
            onClick={() => setCurrentView("akl")}
            style={{
              padding: '15px 25px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              backgroundColor: currentView === "akl" ? '#3d0f1f' : '#0f3460',
              color: '#fff',
              border: `3px solid ${currentView === "akl" ? '#ff00ff' : '#666'}`,
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            🔑 AKL Procedures
          </button>

          <button
            onClick={() => setCurrentView("rf_security")}
            style={{
              padding: '15px 25px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              backgroundColor: currentView === "rf_security" ? '#1f0f0f' : '#0f3460',
              color: '#fff',
              border: `3px solid ${currentView === "rf_security" ? '#ff3333' : '#666'}`,
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            📡 RF Security
          </button>

          <button
            onClick={() => setCurrentView("immo")}
            style={{
              padding: '15px 25px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              backgroundColor: currentView === "immo" ? '#3d1f0f' : '#0f3460',
              color: '#fff',
              border: `3px solid ${currentView === "immo" ? '#ff6600' : '#666'}`,
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            🔐 IMMO Reference
          </button>

          <button
            onClick={() => setCurrentView("live_obd")}
            style={{
              padding: '15px 25px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              backgroundColor: currentView === "live_obd" ? '#0f3d1f' : '#0f3460',
              color: '#fff',
              border: `3px solid ${currentView === "live_obd" ? '#00ff00' : '#666'}`,
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            📡 Live OBD Monitor
          </button>

          <button
            onClick={() => setCurrentView("automated_akl")}
            style={{
              padding: '15px 25px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              backgroundColor: currentView === "automated_akl" ? '#3d0f3d' : '#0f3460',
              color: '#fff',
              border: `3px solid ${currentView === "automated_akl" ? '#ff00ff' : '#666'}`,
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            🔑 Automated AKL
          </button>

          <button
            onClick={() => setCurrentView("can_bus")}
            style={{
              padding: '15px 25px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              backgroundColor: currentView === "can_bus" ? '#3d0000' : '#0f3460',
              color: '#fff',
              border: `3px solid ${currentView === "can_bus" ? '#ff0000' : '#666'}`,
              borderRadius: '10px',
              cursor: 'pointer'
            }}
          >
            🚙 CAN Bus Control
          </button>
        </div>

        {/* Content */}
        {currentView === "diagnostics" && <MinimalOBD />}
        {currentView === "akl" && <AutelAKLProcedures />}
        {currentView === "rf_security" && <RFSecurityResearch />}
        {currentView === "immo" && <AutelKeyProgramming />}
        {currentView === "live_obd" && <LiveOBDMonitor />}
        {currentView === "automated_akl" && <AutomatedAKLInterface />}
        {currentView === "can_bus" && <CANBusController />}
      </div>
    </ErrorBoundary>
  );
}

export default App;
