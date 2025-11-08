/**
 * TRANSPONDER CLONING INTERFACE
 *
 * Clone physical transponder chips and emulate smart keys
 */

import { useState } from "react";
import { TransponderCloningEngine, SmartKeyRFCloner, type TransponderData, type ClonedKey } from "@/lib/transponderCloning";

export default function TransponderCloner() {
  const [engine] = useState(() => new TransponderCloningEngine());
  const [rfCloner] = useState(() => new SmartKeyRFCloner());

  const [device, setDevice] = useState<string | null>(null);
  const [transponderData, setTransponderData] = useState<TransponderData | null>(null);
  const [clonedKeys, setClonedKeys] = useState<ClonedKey[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  const [vin, setVin] = useState("");
  const [manufacturer, setManufacturer] = useState("volkswagen");

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`].slice(-50));
  };

  const detectDevice = async () => {
    addLog("Detecting transponder reader devices...");
    const dev = await engine.detectDevice();

    if (dev) {
      setDevice(dev);
      addLog(`✅ Found device: ${dev.toUpperCase()}`);
    } else {
      addLog("❌ No supported device found");
    }
  };

  const readTransponder = async () => {
    if (!device) {
      addLog("❌ No device connected");
      return;
    }

    addLog("Reading transponder chip...");
    const data = await engine.readTransponder();

    if (data) {
      setTransponderData(data);
      addLog(`✅ Transponder read successfully`);
      addLog(`Type: ${data.type.toUpperCase()}`);
      addLog(`Chip ID: ${data.chipId}`);
      addLog(`Encrypted: ${data.encrypted ? 'YES' : 'NO'}`);
      if (data.cryptoKey) {
        addLog(`Crypto Key: ${data.cryptoKey}`);
      }
    } else {
      addLog("❌ Failed to read transponder");
    }
  };

  const cloneTransponder = async () => {
    if (!transponderData) {
      addLog("❌ No transponder data to clone");
      return;
    }

    addLog("Starting clone operation...");
    const cloned = await engine.cloneToBlankChip(transponderData, "T5577");

    if (cloned.success) {
      setClonedKeys(prev => [...prev, cloned]);
      addLog(`✅ Clone successful!`);
      addLog(`Original: ${cloned.originalChipId}`);
      addLog(`Cloned: ${cloned.clonedChipId}`);
    } else {
      addLog("❌ Clone failed");
    }
  };

  const generateFromVIN = async () => {
    if (!vin || vin.length !== 17) {
      addLog("❌ Invalid VIN (must be 17 characters)");
      return;
    }

    addLog(`Generating key from VIN: ${vin}...`);
    const data = await engine.generateKeyFromVIN(vin, manufacturer);

    setTransponderData(data);
    addLog(`✅ Key generated successfully`);
    addLog(`Chip ID: ${data.chipId}`);
    addLog(`Crypto Key: ${data.cryptoKey}`);
  };

  const programBlankKey = async () => {
    if (!transponderData) {
      addLog("❌ No transponder data to program");
      return;
    }

    addLog("Programming blank key...");
    const success = await engine.programBlankKey(transponderData, "blade");

    if (success) {
      addLog("✅ Key programmed successfully");
    } else {
      addLog("❌ Programming failed");
    }
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
        🔑 TRANSPONDER CLONING & KEY EMULATION
      </h1>

      {/* Legal Warning */}
      <div style={{
        padding: '20px',
        backgroundColor: '#3d1a00',
        border: '3px solid #ff8800',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h2 style={{ fontSize: '1.3rem', color: '#ff8800', marginBottom: '10px' }}>
          ⚠️ AUTHORIZED USE ONLY - LOCKSMITH LICENSE REQUIRED
        </h2>
        <p style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
          Transponder cloning and key programming tools are restricted. Only use with proper locksmith
          licensing, vehicle ownership verification, and legal authorization. Unauthorized key cloning
          is illegal. User assumes all legal responsibility.
        </p>
      </div>

      {/* Device Detection */}
      <div style={{
        padding: '20px',
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        marginBottom: '20px',
        border: `3px solid ${device ? '#00ff00' : '#666'}`
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>
          {device ? `🟢 Device: ${device.toUpperCase()}` : '🔴 No Device Detected'}
        </h2>

        <button
          onClick={detectDevice}
          style={{
            padding: '12px 24px',
            backgroundColor: '#00aa00',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1.1rem',
            cursor: 'pointer'
          }}
        >
          🔍 Detect Device
        </button>

        <div style={{ marginTop: '15px', fontSize: '0.9rem', opacity: 0.7 }}>
          <div>Supported devices: Proxmark3, ACR122U, Chameleon Mini</div>
        </div>
      </div>

      {/* Read Transponder */}
      {device && (
        <div style={{
          padding: '20px',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '3px solid #0066aa'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '15px', color: '#0066aa' }}>
            📡 Read Transponder
          </h2>

          <button
            onClick={readTransponder}
            style={{
              padding: '12px 24px',
              backgroundColor: '#0066aa',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1.1rem',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            📖 Read Chip
          </button>

          {transponderData && (
            <div style={{
              marginTop: '20px',
              padding: '15px',
              backgroundColor: '#000',
              borderRadius: '6px',
              border: '2px solid #0066aa'
            }}>
              <h3 style={{ marginBottom: '10px' }}>Transponder Data:</h3>
              <div style={{ fontSize: '0.9rem' }}>
                <div><strong>Type:</strong> {transponderData.type.toUpperCase()}</div>
                <div><strong>Chip ID:</strong> {transponderData.chipId}</div>
                <div><strong>Encrypted:</strong> {transponderData.encrypted ? 'YES' : 'NO'}</div>
                {transponderData.cryptoKey && (
                  <div><strong>Crypto Key:</strong> {transponderData.cryptoKey}</div>
                )}
                {transponderData.manufacturerCode && (
                  <div><strong>Manufacturer Code:</strong> {transponderData.manufacturerCode}</div>
                )}
                {transponderData.vehicleCode && (
                  <div><strong>Vehicle Code:</strong> {transponderData.vehicleCode}</div>
                )}
              </div>

              <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                <button
                  onClick={cloneTransponder}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#00aa00',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                >
                  🔀 Clone to Blank Chip
                </button>

                <button
                  onClick={programBlankKey}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#aa6600',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                >
                  ✏️ Program Blank Key
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Generate from VIN */}
      <div style={{
        padding: '20px',
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '3px solid #aa00aa'
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '15px', color: '#aa00aa' }}>
          🔮 Generate Key from VIN
        </h2>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '8px' }}>Manufacturer:</label>
          <select
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            style={{
              padding: '10px',
              backgroundColor: '#000',
              color: '#00ff00',
              border: '2px solid #aa00aa',
              borderRadius: '6px',
              fontSize: '1rem',
              marginBottom: '10px'
            }}
          >
            <option value="volkswagen">Volkswagen</option>
            <option value="audi">Audi</option>
            <option value="bmw">BMW</option>
            <option value="mercedes">Mercedes-Benz</option>
            <option value="toyota">Toyota</option>
            <option value="honda">Honda</option>
            <option value="ford">Ford</option>
            <option value="gm">General Motors</option>
          </select>

          <label style={{ display: 'block', marginBottom: '8px' }}>VIN (17 characters):</label>
          <input
            type="text"
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
            placeholder="WVWZZZ1KZBW123456"
            maxLength={17}
            style={{
              padding: '10px',
              backgroundColor: '#000',
              color: '#00ff00',
              border: '2px solid #aa00aa',
              borderRadius: '6px',
              fontSize: '1.1rem',
              width: '350px',
              fontFamily: 'monospace'
            }}
          />
        </div>

        <button
          onClick={generateFromVIN}
          disabled={vin.length !== 17}
          style={{
            padding: '12px 24px',
            backgroundColor: vin.length === 17 ? '#aa00aa' : '#666',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1.1rem',
            cursor: vin.length === 17 ? 'pointer' : 'not-allowed'
          }}
        >
          🔮 Generate Key
        </button>
      </div>

      {/* Cloned Keys History */}
      {clonedKeys.length > 0 && (
        <div style={{
          padding: '20px',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '3px solid #00ff00'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>
            📋 Cloned Keys ({clonedKeys.length})
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {clonedKeys.map((key, i) => (
              <div
                key={i}
                style={{
                  padding: '12px',
                  backgroundColor: '#0a2a0a',
                  border: '2px solid #00ff00',
                  borderRadius: '6px'
                }}
              >
                <div style={{ fontSize: '0.9rem' }}>
                  <div><strong>Clone #{i + 1}</strong> - {new Date(key.timestamp).toLocaleString()}</div>
                  <div>Original: {key.originalChipId}</div>
                  <div>Cloned: {key.clonedChipId}</div>
                  <div>Type: {key.type} | Manufacturer: {key.manufacturer}</div>
                  <div>Frequency: {key.frequency} kHz</div>
                </div>
              </div>
            ))}
          </div>
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
