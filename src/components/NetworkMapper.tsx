/**
 * VEHICLE NETWORK TOPOLOGY MAPPER
 *
 * Scan and map all ECUs, networks, and connections
 */

import { useState } from "react";
import { VehicleNetworkMapper, type NetworkTopology, type ECU } from "@/lib/networkMapping";

export default function NetworkMapper() {
  const [mapper] = useState(() => new VehicleNetworkMapper());
  const [topology, setTopology] = useState<NetworkTopology | null>(null);
  const [selectedECU, setSelectedECU] = useState<ECU | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-100));
  };

  const startScan = async () => {
    setIsScanning(true);
    addLog("Starting comprehensive network scan...");

    const result = await mapper.scanAllNetworks();
    setTopology(result);

    addLog(`✅ Scan complete!`);
    addLog(`Networks: ${result.networks.length}`);
    addLog(`ECUs: ${result.ecus.length}`);
    addLog(`Gateways: ${result.gateways.length}`);

    setIsScanning(false);
  };

  const bypassGateway = async (addr: number) => {
    addLog(`Attempting gateway bypass at 0x${addr.toString(16).toUpperCase()}...`);
    const success = await mapper.bypassGateway(addr);

    if (success) {
      addLog("✅ Gateway bypassed!");
    } else {
      addLog("❌ Bypass failed");
    }
  };

  const findHidden = async () => {
    addLog("Searching for hidden ECUs...");
    const hidden = await mapper.findHiddenECUs();
    addLog(`Found ${hidden.length} hidden ECU(s)`);
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#0a0a0a', color: '#00ff00', fontFamily: 'monospace', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '20px' }}>🗺️ VEHICLE NETWORK MAPPER</h1>

      {/* Scan Control */}
      <div style={{ padding: '20px', backgroundColor: '#1a1a1a', borderRadius: '8px', marginBottom: '20px', border: '3px solid #00aaff' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '15px', color: '#00aaff' }}>🔍 Network Scan</h2>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={startScan} disabled={isScanning} style={{ padding: '12px 24px', backgroundColor: isScanning ? '#666' : '#00aaff', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '1.1rem', cursor: isScanning ? 'not-allowed' : 'pointer' }}>
            {isScanning ? '⏳ Scanning...' : '🔍 Start Comprehensive Scan'}
          </button>

          <button onClick={findHidden} disabled={isScanning} style={{ padding: '12px 24px', backgroundColor: '#aa00aa', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '1.1rem', cursor: isScanning ? 'not-allowed' : 'pointer' }}>
            🕵️ Find Hidden ECUs
          </button>
        </div>
      </div>

      {/* Networks */}
      {topology && topology.networks.length > 0 && (
        <div style={{ padding: '20px', backgroundColor: '#1a1a1a', borderRadius: '8px', marginBottom: '20px', border: '3px solid #00ff00' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>🌐 CAN Networks ({topology.networks.length})</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px' }}>
            {topology.networks.map((net, i) => (
              <div key={i} style={{ padding: '12px', backgroundColor: '#000', border: '2px solid #00ff00', borderRadius: '6px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{net.name}</div>
                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                  <div>Bitrate: {net.bitrate.toLocaleString()} bps</div>
                  <div>Utilization: {net.utilization.toFixed(1)}%</div>
                  <div>Message Rate: {net.messageRate} msg/s</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ECUs */}
      {topology && topology.ecus.length > 0 && (
        <div style={{ padding: '20px', backgroundColor: '#1a1a1a', borderRadius: '8px', marginBottom: '20px', border: '3px solid #00ff00' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>💻 Discovered ECUs ({topology.ecus.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {topology.ecus.map((ecu) => (
              <div key={ecu.id} onClick={() => setSelectedECU(ecu)} style={{ padding: '12px', backgroundColor: selectedECU?.id === ecu.id ? '#003d00' : '#000', border: `2px solid ${ecu.protected ? '#ff0000' : '#00ff00'}`, borderRadius: '6px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{ecu.name}</div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                      Address: 0x{ecu.address.toString(16).toUpperCase()} | Network: {ecu.network} | Services: {ecu.services.length}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '5px', fontSize: '0.8rem' }}>
                    {ecu.protected && <span style={{ padding: '3px 8px', backgroundColor: '#3d0000', borderRadius: '3px' }}>🔒 Protected</span>}
                    {ecu.name.toLowerCase().includes('gateway') && <span style={{ padding: '3px 8px', backgroundColor: '#3d1a00', borderRadius: '3px' }}>🌐 Gateway</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gateways */}
      {topology && topology.gateways.length > 0 && (
        <div style={{ padding: '20px', backgroundColor: '#1a1a1a', borderRadius: '8px', marginBottom: '20px', border: '3px solid #ff6600' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '15px', color: '#ff6600' }}>🌐 Gateway Modules ({topology.gateways.length})</h2>
          {topology.gateways.map((gw) => (
            <div key={gw.id} style={{ padding: '15px', backgroundColor: '#000', border: '2px solid #ff6600', borderRadius: '6px', marginBottom: '10px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>{gw.name} - 0x{gw.address.toString(16).toUpperCase()}</div>
              <div style={{ fontSize: '0.9rem', marginBottom: '10px' }}>
                Supported Services: {gw.services.map(s => s.name).join(', ')}
              </div>
              <button onClick={() => bypassGateway(gw.address)} style={{ padding: '8px 16px', backgroundColor: '#ff6600', color: '#000', border: 'none', borderRadius: '4px', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 'bold' }}>
                ⚡ Attempt Bypass
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Selected ECU Details */}
      {selectedECU && (
        <div style={{ padding: '20px', backgroundColor: '#1a1a1a', borderRadius: '8px', marginBottom: '20px', border: '3px solid #00ffaa' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '15px', color: '#00ffaa' }}>📋 ECU Details: {selectedECU.name}</h2>
          <div style={{ marginBottom: '15px' }}>
            <div><strong>Address:</strong> 0x{selectedECU.address.toString(16).toUpperCase()}</div>
            <div><strong>Network:</strong> {selectedECU.network}</div>
            {selectedECU.partNumber && <div><strong>Part Number:</strong> {selectedECU.partNumber}</div>}
            {selectedECU.softwareVersion && <div><strong>Software:</strong> {selectedECU.softwareVersion}</div>}
            {selectedECU.hardwareVersion && <div><strong>Hardware:</strong> {selectedECU.hardwareVersion}</div>}
            <div><strong>Protected:</strong> {selectedECU.protected ? '🔒 YES' : '✅ NO'}</div>
          </div>

          <h3 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Supported UDS Services ({selectedECU.services.length}):</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '8px' }}>
            {selectedECU.services.map((svc) => (
              <div key={svc.id} style={{ padding: '8px', backgroundColor: '#000', border: '1px solid #00ffaa', borderRadius: '4px', fontSize: '0.85rem' }}>
                0x{svc.id.toString(16).toUpperCase().padStart(2, '0')} - {svc.name}
                {svc.subfunctions && svc.subfunctions.length > 0 && (
                  <div style={{ opacity: 0.7, marginTop: '3px' }}>
                    Subfunctions: {svc.subfunctions.map(sf => `0x${sf.toString(16).toUpperCase()}`).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Log */}
      <div style={{ padding: '20px', backgroundColor: '#1a1a1a', borderRadius: '8px', border: '3px solid #00ff00' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>📜 Activity Log</h2>
        <div style={{ backgroundColor: '#000', padding: '15px', borderRadius: '6px', maxHeight: '300px', overflowY: 'auto', fontSize: '0.9rem' }}>
          {logs.length === 0 ? <div style={{ opacity: 0.5 }}>No activity yet...</div> : logs.map((log, i) => <div key={i} style={{ marginBottom: '5px' }}>{log}</div>)}
        </div>
      </div>
    </div>
  );
}
