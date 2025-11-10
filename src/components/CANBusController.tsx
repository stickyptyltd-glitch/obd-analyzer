/**
 * CAN BUS EXPLOITATION CONTROLLER
 *
 * Direct CAN bus manipulation, fuzzing, injection, and replay attacks
 */

import { useState } from "react";
import { CANBusExploitKit, ECUFlasher, type CANFrame, type FuzzConfig } from "@/lib/canBusHacking";

export default function CANBusController() {
  const [canKit] = useState(() => new CANBusExploitKit());
  const [ecuFlasher] = useState(() => new ECUFlasher());

  const [interface_name, setInterfaceName] = useState("can0");
  const [bitrate, setBitrate] = useState(500000);
  const [initialized, setInitialized] = useState(false);

  const [capturedFrames, setCapturedFrames] = useState<CANFrame[]>([]);
  const [analysisResults, setAnalysisResults] = useState<Map<number, any>>(new Map());
  const [isCapturing, setIsCapturing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Fuzzing config
  const [fuzzIdStart, setFuzzIdStart] = useState(0x000);
  const [fuzzIdEnd, setFuzzIdEnd] = useState(0x7FF);
  const [fuzzDataLen, setFuzzDataLen] = useState(8);
  const [fuzzRate, setFuzzRate] = useState(10);
  const [fuzzDuration, setFuzzDuration] = useState(5);

  // Injection config
  const [injCanId, setInjCanId] = useState(0x123);
  const [injData, setInjData] = useState("00 00 00 00 00 00 00 00");
  const [injRate, setInjRate] = useState(10);
  const [injDuration, setInjDuration] = useState(5);

  // ECU tuning
  const [boostInc, setBoostInc] = useState(0);
  const [speedLimRemove, setSpeedLimRemove] = useState(false);
  const [revLimInc, setRevLimInc] = useState(0);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`].slice(-100));
  };

  const handleInitialize = async () => {
    addLog(`Initializing ${interface_name} at ${bitrate} bps...`);
    const success = await canKit.initialize(interface_name, bitrate);

    if (success) {
      setInitialized(true);
      addLog(`✅ CAN interface initialized`);
    } else {
      addLog(`❌ Failed to initialize CAN interface`);
    }
  };

  const handleCapture = async () => {
    setIsCapturing(true);
    addLog(`Capturing CAN traffic for 10 seconds...`);

    const frames = await canKit.captureTraffic(10);
    setCapturedFrames(frames);
    addLog(`✅ Captured ${frames.length} frames`);

    // Auto-analyze
    const analysis = await canKit.analyzeTrafficPatterns();
    setAnalysisResults(analysis);
    addLog(`✅ Analysis complete - ${analysis.size} unique IDs`);

    setIsCapturing(false);
  };

  const handleReplayAttack = async () => {
    if (capturedFrames.length === 0) {
      addLog(`❌ No captured frames to replay`);
      return;
    }

    addLog(`🔁 Replaying ${capturedFrames.length} frames...`);
    await canKit.replayAttack(capturedFrames, 1.0);
    addLog(`✅ Replay complete`);
  };

  const handleFuzzAttack = async () => {
    const config: FuzzConfig = {
      idRange: [fuzzIdStart, fuzzIdEnd],
      dataLength: fuzzDataLen,
      rate: fuzzRate,
      duration: fuzzDuration,
      randomData: true
    };

    addLog(`⚠️ Starting CAN fuzzing attack...`);
    addLog(`ID Range: 0x${fuzzIdStart.toString(16).toUpperCase()}-0x${fuzzIdEnd.toString(16).toUpperCase()}`);
    addLog(`Rate: ${fuzzRate} frames/sec, Duration: ${fuzzDuration}s`);

    await canKit.fuzzCAN(config);
    addLog(`✅ Fuzzing complete`);
  };

  const handleInjectionAttack = async () => {
    const dataBytes = injData.split(' ').map(b => parseInt(b, 16));

    addLog(`💉 Injecting CAN ID 0x${injCanId.toString(16).toUpperCase()}`);
    addLog(`Data: ${injData}`);
    addLog(`Rate: ${injRate} Hz, Duration: ${injDuration}s`);

    await canKit.injectionAttack(injCanId, dataBytes, injRate, injDuration);
    addLog(`✅ Injection complete`);
  };

  const handleUnlockDoors = async () => {
    addLog(`🔓 Sending unlock command to door locks...`);
    await canKit.unlockDoors();
    addLog(`✅ Unlock command sent`);
  };

  const handleLockDoors = async () => {
    addLog(`🔒 Sending lock command to door locks...`);
    await canKit.lockDoors();
    addLog(`✅ Lock command sent`);
  };

  const handleSpoofSpeed = async () => {
    const speed = 120; // km/h
    addLog(`📊 Spoofing wheel speed sensors to ${speed} km/h...`);
    await canKit.spoofSpeed(speed);
    addLog(`✅ Speed spoofed`);
  };

  const handleDisableABS = async () => {
    if (!confirm("⚠️ DANGER: This will disable ABS. Continue?")) return;
    addLog(`⚠️ Disabling ABS system...`);
    await canKit.disableABS();
    addLog(`✅ ABS disable command sent`);
  };

  const handleTuneECU = async () => {
    addLog(`🔧 Applying ECU tune...`);

    await ecuFlasher.tuneECU({
      boostIncrease: boostInc > 0 ? boostInc : undefined,
      speedLimiterRemove: speedLimRemove,
      revLimiterIncrease: revLimInc > 0 ? revLimInc : undefined
    });

    addLog(`✅ ECU tune applied`);
  };

  const handleReadECU = async () => {
    addLog(`📖 Reading ECU flash memory...`);
    const flash = await ecuFlasher.readFlash("UDS");
    addLog(`✅ Read ${flash.length} bytes from ECU`);
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
        🚙 CAN BUS EXPLOITATION CONTROLLER
      </h1>

      {/* Critical Warning */}
      <div style={{
        padding: '20px',
        backgroundColor: '#3d0000',
        border: '3px solid #ff0000',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h2 style={{ fontSize: '1.3rem', color: '#ff0000', marginBottom: '10px' }}>
          ⚠️ EXTREME DANGER - AUTHORIZED USE ONLY
        </h2>
        <p style={{ fontSize: '0.9rem', lineHeight: '1.6', color: '#ffaaaa' }}>
          This tool performs DIRECT CAN BUS MANIPULATION that can DISABLE SAFETY SYSTEMS, UNLOCK VEHICLES,
          and CAUSE PHYSICAL DAMAGE. Only use in controlled research environments with proper authorization.
          Vehicle exploitation and unauthorized access is ILLEGAL and DANGEROUS. User assumes ALL RISK.
        </p>
      </div>

      {/* Initialization Panel */}
      <div style={{
        padding: '20px',
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        marginBottom: '20px',
        border: `3px solid ${initialized ? '#00ff00' : '#666'}`
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>
          {initialized ? '🟢 INTERFACE ACTIVE' : '🔴 INTERFACE INACTIVE'}
        </h2>

        {!initialized ? (
          <div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '8px' }}>CAN Interface:</label>
              <input
                type="text"
                value={interface_name}
                onChange={(e) => setInterfaceName(e.target.value)}
                placeholder="can0, vcan0, etc."
                style={{
                  padding: '10px',
                  backgroundColor: '#000',
                  color: '#00ff00',
                  border: '2px solid #00ff00',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  width: '200px',
                  marginRight: '15px'
                }}
              />

              <label style={{ marginLeft: '15px', marginRight: '8px' }}>Bitrate:</label>
              <select
                value={bitrate}
                onChange={(e) => setBitrate(parseInt(e.target.value))}
                style={{
                  padding: '10px',
                  backgroundColor: '#000',
                  color: '#00ff00',
                  border: '2px solid #00ff00',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
              >
                <option value="125000">125 kbps</option>
                <option value="250000">250 kbps</option>
                <option value="500000">500 kbps (Standard)</option>
                <option value="1000000">1 Mbps</option>
              </select>
            </div>

            <button
              onClick={handleInitialize}
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
              🚀 INITIALIZE CAN INTERFACE
            </button>
          </div>
        ) : (
          <div style={{ fontSize: '1.1rem' }}>
            <div>Interface: <strong>{interface_name}</strong></div>
            <div>Bitrate: <strong>{bitrate.toLocaleString()} bps</strong></div>
          </div>
        )}
      </div>

      {initialized && (
        <>
          {/* Traffic Capture & Analysis */}
          <div style={{
            padding: '20px',
            backgroundColor: '#1a1a1a',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '3px solid #00aaff'
          }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '15px', color: '#00aaff' }}>
              📊 Traffic Capture & Analysis
            </h2>

            <div style={{ marginBottom: '15px' }}>
              <button
                onClick={handleCapture}
                disabled={isCapturing}
                style={{
                  padding: '12px 24px',
                  backgroundColor: isCapturing ? '#666' : '#0066aa',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1.1rem',
                  cursor: isCapturing ? 'not-allowed' : 'pointer',
                  marginRight: '10px'
                }}
              >
                {isCapturing ? '⏳ Capturing...' : '📡 Capture 10s'}
              </button>

              <button
                onClick={handleReplayAttack}
                disabled={capturedFrames.length === 0}
                style={{
                  padding: '12px 24px',
                  backgroundColor: capturedFrames.length === 0 ? '#666' : '#aa6600',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1.1rem',
                  cursor: capturedFrames.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                🔁 Replay ({capturedFrames.length} frames)
              </button>
            </div>

            {analysisResults.size > 0 && (
              <div style={{
                backgroundColor: '#000',
                padding: '15px',
                borderRadius: '6px',
                fontSize: '0.9rem',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                <h3 style={{ marginBottom: '10px' }}>Analysis Results:</h3>
                {Array.from(analysisResults.entries()).map(([id, info]) => (
                  <div key={id} style={{
                    padding: '8px',
                    backgroundColor: '#1a1a1a',
                    marginBottom: '6px',
                    borderLeft: '3px solid #00aaff'
                  }}>
                    <div><strong>ID 0x{id.toString(16).toUpperCase()}</strong> - {info.name}</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                      Count: {info.count} | Freq: {info.frequency.toFixed(1)} Hz |
                      Periodic: {info.periodic ? 'Yes' : 'No'} |
                      Sample: {info.sample}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CAN Fuzzing */}
          <div style={{
            padding: '20px',
            backgroundColor: '#1a1a1a',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '3px solid #ff8800'
          }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '15px', color: '#ff8800' }}>
              ⚡ CAN Fuzzing Attack
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>ID Start (hex):</label>
                <input
                  type="text"
                  value={`0x${fuzzIdStart.toString(16).toUpperCase()}`}
                  onChange={(e) => setFuzzIdStart(parseInt(e.target.value, 16) || 0)}
                  style={{
                    padding: '8px',
                    backgroundColor: '#000',
                    color: '#00ff00',
                    border: '2px solid #ff8800',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    width: '100%'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>ID End (hex):</label>
                <input
                  type="text"
                  value={`0x${fuzzIdEnd.toString(16).toUpperCase()}`}
                  onChange={(e) => setFuzzIdEnd(parseInt(e.target.value, 16) || 0x7FF)}
                  style={{
                    padding: '8px',
                    backgroundColor: '#000',
                    color: '#00ff00',
                    border: '2px solid #ff8800',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    width: '100%'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>Data Length (bytes):</label>
                <input
                  type="number"
                  value={fuzzDataLen}
                  onChange={(e) => setFuzzDataLen(parseInt(e.target.value) || 8)}
                  min="1"
                  max="8"
                  style={{
                    padding: '8px',
                    backgroundColor: '#000',
                    color: '#00ff00',
                    border: '2px solid #ff8800',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    width: '100%'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>Rate (frames/sec):</label>
                <input
                  type="number"
                  value={fuzzRate}
                  onChange={(e) => setFuzzRate(parseInt(e.target.value) || 10)}
                  min="1"
                  max="1000"
                  style={{
                    padding: '8px',
                    backgroundColor: '#000',
                    color: '#00ff00',
                    border: '2px solid #ff8800',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    width: '100%'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '5px' }}>Duration (seconds):</label>
                <input
                  type="number"
                  value={fuzzDuration}
                  onChange={(e) => setFuzzDuration(parseInt(e.target.value) || 5)}
                  min="1"
                  max="60"
                  style={{
                    padding: '8px',
                    backgroundColor: '#000',
                    color: '#00ff00',
                    border: '2px solid #ff8800',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    width: '100%'
                  }}
                />
              </div>
            </div>

            <button
              onClick={handleFuzzAttack}
              style={{
                padding: '12px 24px',
                backgroundColor: '#ff8800',
                color: '#000',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1.1rem',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ⚡ START FUZZING
            </button>
          </div>

          {/* Frame Injection */}
          <div style={{
            padding: '20px',
            backgroundColor: '#1a1a1a',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '3px solid #ff00ff'
          }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '15px', color: '#ff00ff' }}>
              💉 Frame Injection Attack
            </h2>

            <div style={{ marginBottom: '15px' }}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>CAN ID (hex):</label>
                <input
                  type="text"
                  value={`0x${injCanId.toString(16).toUpperCase()}`}
                  onChange={(e) => setInjCanId(parseInt(e.target.value, 16) || 0x123)}
                  style={{
                    padding: '8px',
                    backgroundColor: '#000',
                    color: '#00ff00',
                    border: '2px solid #ff00ff',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    width: '200px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Data (hex bytes, space-separated):</label>
                <input
                  type="text"
                  value={injData}
                  onChange={(e) => setInjData(e.target.value)}
                  placeholder="00 01 02 03 04 05 06 07"
                  style={{
                    padding: '8px',
                    backgroundColor: '#000',
                    color: '#00ff00',
                    border: '2px solid #ff00ff',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    width: '400px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Rate (Hz):</label>
                  <input
                    type="number"
                    value={injRate}
                    onChange={(e) => setInjRate(parseInt(e.target.value) || 10)}
                    style={{
                      padding: '8px',
                      backgroundColor: '#000',
                      color: '#00ff00',
                      border: '2px solid #ff00ff',
                      borderRadius: '4px',
                      fontSize: '1rem',
                      width: '100px'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '5px' }}>Duration (s):</label>
                  <input
                    type="number"
                    value={injDuration}
                    onChange={(e) => setInjDuration(parseInt(e.target.value) || 5)}
                    style={{
                      padding: '8px',
                      backgroundColor: '#000',
                      color: '#00ff00',
                      border: '2px solid #ff00ff',
                      borderRadius: '4px',
                      fontSize: '1rem',
                      width: '100px'
                    }}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleInjectionAttack}
              style={{
                padding: '12px 24px',
                backgroundColor: '#ff00ff',
                color: '#000',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1.1rem',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              💉 START INJECTION
            </button>
          </div>

          {/* Vehicle Control */}
          <div style={{
            padding: '20px',
            backgroundColor: '#1a1a1a',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '3px solid #ff0000'
          }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '15px', color: '#ff0000' }}>
              🚗 Direct Vehicle Control (DANGEROUS)
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              <button
                onClick={handleUnlockDoors}
                style={{
                  padding: '15px',
                  backgroundColor: '#aa6600',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                🔓 Unlock Doors
              </button>

              <button
                onClick={handleLockDoors}
                style={{
                  padding: '15px',
                  backgroundColor: '#0066aa',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                🔒 Lock Doors
              </button>

              <button
                onClick={handleSpoofSpeed}
                style={{
                  padding: '15px',
                  backgroundColor: '#aa00aa',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                📊 Spoof Speed
              </button>

              <button
                onClick={handleDisableABS}
                style={{
                  padding: '15px',
                  backgroundColor: '#aa0000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
              >
                ⚠️ Disable ABS
              </button>
            </div>
          </div>

          {/* ECU Tuning */}
          <div style={{
            padding: '20px',
            backgroundColor: '#1a1a1a',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '3px solid #00ff00'
          }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>
              🔧 ECU Tuning & Flash
            </h2>

            <div style={{ marginBottom: '15px' }}>
              <div style={{ marginBottom: '10px' }}>
                <label>
                  <input
                    type="checkbox"
                    checked={speedLimRemove}
                    onChange={(e) => setSpeedLimRemove(e.target.checked)}
                    style={{ marginRight: '10px' }}
                  />
                  Remove Speed Limiter
                </label>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Boost Increase (PSI):</label>
                <input
                  type="number"
                  value={boostInc}
                  onChange={(e) => setBoostInc(parseInt(e.target.value) || 0)}
                  min="0"
                  max="15"
                  style={{
                    padding: '8px',
                    backgroundColor: '#000',
                    color: '#00ff00',
                    border: '2px solid #00ff00',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    width: '150px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Rev Limiter Increase (RPM):</label>
                <input
                  type="number"
                  value={revLimInc}
                  onChange={(e) => setRevLimInc(parseInt(e.target.value) || 0)}
                  min="0"
                  max="2000"
                  step="100"
                  style={{
                    padding: '8px',
                    backgroundColor: '#000',
                    color: '#00ff00',
                    border: '2px solid #00ff00',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    width: '150px'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleReadECU}
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
                📖 Read ECU Flash
              </button>

              <button
                onClick={handleTuneECU}
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
                🔧 Apply Tune
              </button>
            </div>
          </div>
        </>
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
          maxHeight: '400px',
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
