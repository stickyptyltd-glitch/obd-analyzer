/**
 * LIVE OBD-II MONITORING DASHBOARD
 *
 * Real-time vehicle diagnostics with ELM327/STN1110/SocketCAN
 */

import { useState, useEffect } from "react";
import { LiveOBDInterface, type OBDAdapter, type LiveData, type VehicleInfo } from "@/lib/liveOBDInterface";

export default function LiveOBDMonitor() {
  const [obd] = useState(() => new LiveOBDInterface());
  const [connected, setConnected] = useState(false);
  const [adapter, setAdapter] = useState<OBDAdapter>("elm327");
  const [port, setPort] = useState("/dev/rfcomm0");
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null);
  const [liveData, setLiveData] = useState<Map<string, LiveData>>(new Map());
  const [dtcs, setDtcs] = useState<string[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`].slice(-50));
  };

  const handleConnect = async () => {
    addLog(`Connecting to ${adapter} on ${port}...`);
    const success = await obd.connect(adapter, port);

    if (success) {
      setConnected(true);
      addLog("✅ Connected to vehicle");

      // Get vehicle info
      const info = await obd.getVehicleInfo();
      setVehicleInfo(info);
      addLog(`Vehicle: ${info.vin}`);

      // Read DTCs
      const codes = await obd.getDTCs();
      setDtcs(codes);
      addLog(`DTCs found: ${codes.length}`);
    } else {
      addLog("❌ Connection failed");
    }
  };

  const handleDisconnect = () => {
    obd.disconnect();
    setConnected(false);
    setIsMonitoring(false);
    addLog("Disconnected from vehicle");
  };

  const startMonitoring = () => {
    if (!connected) return;

    const pids = ["010C", "010D", "0105", "010F", "0110", "0111", "010B"];

    // Setup callbacks for each PID
    pids.forEach(pid => {
      obd.onData(pid, (data: LiveData) => {
        setLiveData(prev => {
          const newMap = new Map(prev);
          newMap.set(data.pid, data);
          return newMap;
        });
      });
    });

    obd.startMonitoring(pids, 200);
    setIsMonitoring(true);
    addLog("📊 Started live monitoring");
  };

  const stopMonitoring = () => {
    obd.stopMonitoring();
    setIsMonitoring(false);
    addLog("⏸️ Stopped monitoring");
  };

  const clearDTCs = async () => {
    const success = await obd.clearDTCs();
    if (success) {
      setDtcs([]);
      addLog("✅ DTCs cleared");
    } else {
      addLog("❌ Failed to clear DTCs");
    }
  };

  const readDTCs = async () => {
    const codes = await obd.getDTCs();
    setDtcs(codes);
    addLog(`Read ${codes.length} DTCs`);
  };

  // Format live data for display
  const getDataValue = (pid: string): { value: string; status: string } => {
    const data = liveData.get(pid);
    if (!data) return { value: "---", status: "normal" };

    const val = `${data.value.toFixed(1)} ${data.unit}`;

    // Status based on thresholds
    if (pid === "Engine RPM" && data.value > 6000) return { value: val, status: "critical" };
    if (pid === "Coolant Temperature" && data.value > 100) return { value: val, status: "critical" };
    if (pid === "Coolant Temperature" && data.value > 95) return { value: val, status: "warning" };

    return { value: val, status: "normal" };
  };

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#0a0a0a',
      color: '#00ff00',
      fontFamily: 'monospace',
      minHeight: '100vh'
    }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '20px' }}>
        📡 LIVE OBD-II MONITOR
      </h1>

      {/* Connection Panel */}
      <div style={{
        padding: '20px',
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        marginBottom: '20px',
        border: `3px solid ${connected ? '#00ff00' : '#666'}`
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>
          {connected ? '🟢 CONNECTED' : '🔴 DISCONNECTED'}
        </h2>

        {!connected ? (
          <div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Adapter Type:</label>
              <select
                value={adapter}
                onChange={(e) => setAdapter(e.target.value as OBDAdapter)}
                style={{
                  padding: '10px',
                  backgroundColor: '#000',
                  color: '#00ff00',
                  border: '2px solid #00ff00',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  width: '300px'
                }}
              >
                <option value="elm327">ELM327 (Bluetooth/Serial)</option>
                <option value="stn1110">STN1110 (Enhanced)</option>
                <option value="vlinker">VLinker FS/FD</option>
                <option value="obdlink">OBDLink SX/MX+</option>
                <option value="socketcan">SocketCAN (Linux)</option>
              </select>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Port/Device:</label>
              <input
                type="text"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="/dev/rfcomm0 or /dev/ttyUSB0"
                style={{
                  padding: '10px',
                  backgroundColor: '#000',
                  color: '#00ff00',
                  border: '2px solid #00ff00',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  width: '300px'
                }}
              />
            </div>

            <button
              onClick={handleConnect}
              style={{
                padding: '15px 30px',
                backgroundColor: '#00aa00',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1.2rem',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🔌 CONNECT TO VEHICLE
            </button>
          </div>
        ) : (
          <div>
            {vehicleInfo && (
              <div style={{ marginBottom: '15px' }}>
                <div><strong>VIN:</strong> {vehicleInfo.vin}</div>
                <div><strong>ECUs:</strong> {vehicleInfo.ecuCount}</div>
                <div><strong>Protocol:</strong> {vehicleInfo.protocols.join(', ')}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {!isMonitoring ? (
                <button
                  onClick={startMonitoring}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#00aa00',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                >
                  ▶️ START MONITORING
                </button>
              ) : (
                <button
                  onClick={stopMonitoring}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#aa6600',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                >
                  ⏸️ STOP MONITORING
                </button>
              )}

              <button
                onClick={readDTCs}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#0066aa',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                📋 READ DTCs
              </button>

              <button
                onClick={handleDisconnect}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#aa0000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                🔌 DISCONNECT
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Live Data Dashboard */}
      {connected && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '15px',
          marginBottom: '20px'
        }}>
          {[
            { label: "Engine RPM", pid: "Engine RPM", icon: "⚙️" },
            { label: "Vehicle Speed", pid: "Vehicle Speed", icon: "🏎️" },
            { label: "Coolant Temp", pid: "Coolant Temperature", icon: "🌡️" },
            { label: "Intake Temp", pid: "Intake Air Temperature", icon: "💨" },
            { label: "MAF Rate", pid: "MAF Air Flow Rate", icon: "🌪️" },
            { label: "Throttle Pos", pid: "Throttle Position", icon: "🎚️" },
            { label: "Intake Pressure", pid: "Intake Manifold Pressure", icon: "📊" }
          ].map(({ label, pid, icon }) => {
            const { value, status } = getDataValue(pid);
            const bgColor = status === "critical" ? "#3d0000" : status === "warning" ? "#3d2200" : "#1a1a1a";
            const borderColor = status === "critical" ? "#ff0000" : status === "warning" ? "#ffaa00" : "#00ff00";

            return (
              <div
                key={pid}
                style={{
                  padding: '20px',
                  backgroundColor: bgColor,
                  border: `3px solid ${borderColor}`,
                  borderRadius: '8px',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '10px' }}>{icon}</div>
                <div style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '5px' }}>{label}</div>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  color: borderColor
                }}>
                  {value}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DTCs Panel */}
      {connected && (
        <div style={{
          padding: '20px',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          marginBottom: '20px',
          border: `3px solid ${dtcs.length > 0 ? '#ff3333' : '#00ff00'}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ fontSize: '1.5rem' }}>
              {dtcs.length > 0 ? `⚠️ ${dtcs.length} FAULT CODE(S)` : '✅ NO FAULT CODES'}
            </h2>
            {dtcs.length > 0 && (
              <button
                onClick={clearDTCs}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#aa0000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                🗑️ CLEAR DTCs
              </button>
            )}
          </div>

          {dtcs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {dtcs.map((code, i) => (
                <div
                  key={i}
                  style={{
                    padding: '15px',
                    backgroundColor: '#2a0000',
                    border: '2px solid #ff3333',
                    borderRadius: '6px',
                    fontSize: '1.2rem'
                  }}
                >
                  <strong>{code}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Activity Log */}
      <div style={{
        padding: '20px',
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        border: '3px solid #00ff00'
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>📜 Activity Log</h2>
        <div style={{
          backgroundColor: '#000',
          padding: '15px',
          borderRadius: '6px',
          maxHeight: '300px',
          overflowY: 'auto',
          fontSize: '0.9rem'
        }}>
          {logs.length === 0 ? (
            <div style={{ opacity: 0.5 }}>No activity yet...</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} style={{ marginBottom: '5px' }}>{log}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
