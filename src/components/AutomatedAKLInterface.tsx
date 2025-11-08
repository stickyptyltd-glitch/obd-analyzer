/**
 * AUTOMATED ALL KEYS LOST (AKL) INTERFACE
 *
 * Automated key programming for VW/Audi MQB, GM, BMW CAS3/CAS3+
 */

import { useState } from "react";
import { AutomatedAKLEngine, BatchAKLProcessor, type AKLProgress, type AKLResult } from "@/lib/automatedAKL";

export default function AutomatedAKLInterface() {
  const [engine] = useState(() => new AutomatedAKLEngine());
  const [batchProcessor] = useState(() => new BatchAKLProcessor());

  const [mode, setMode] = useState<"single" | "batch">("single");
  const [manufacturer, setManufacturer] = useState<"vw" | "gm" | "bmw">("vw");
  const [vin, setVin] = useState("");
  const [keyCount, setKeyCount] = useState(1);
  const [method, setMethod] = useState<"obd" | "bench">("obd");

  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<AKLProgress | null>(null);
  const [result, setResult] = useState<AKLResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const [batchQueue, setBatchQueue] = useState<Array<{ vin: string; make: string; keyCount: number }>>([]);
  const [batchResults, setBatchResults] = useState<AKLResult[]>([]);

  const handleProgressUpdate = (prog: AKLProgress) => {
    setProgress(prog);
    setLogs(prev => [...prev, prog.message]);
  };

  const startSingleAKL = async () => {
    if (!vin) {
      alert("Please enter VIN");
      return;
    }

    setIsRunning(true);
    setResult(null);
    setLogs([]);
    setProgress(null);

    let aklResult: AKLResult;

    if (manufacturer === "vw") {
      aklResult = await engine.executeVWMQBAKL(vin, keyCount, handleProgressUpdate);
    } else if (manufacturer === "gm") {
      aklResult = await engine.executeGMAKL(vin, keyCount);
    } else {
      aklResult = await engine.executeBMWCAS3AKL(vin, method);
    }

    setResult(aklResult);
    setIsRunning(false);
  };

  const addToBatch = () => {
    if (!vin) {
      alert("Please enter VIN");
      return;
    }

    const makeMap = { vw: "Volkswagen", gm: "GM", bmw: "BMW" };
    setBatchQueue(prev => [...prev, {
      vin,
      make: makeMap[manufacturer],
      keyCount
    }]);

    setVin("");
  };

  const removeFromBatch = (index: number) => {
    setBatchQueue(prev => prev.filter((_, i) => i !== index));
  };

  const processBatch = async () => {
    setIsRunning(true);
    setBatchResults([]);
    setLogs([]);

    const results = await batchProcessor.processQueue((current, total, result) => {
      setLogs(prev => [
        ...prev,
        `[${current}/${total}] ${result.success ? '✅' : '❌'} ${result.vehicleInfo.vin} - ${result.keysProgrammed} keys in ${(result.duration / 1000).toFixed(1)}s`
      ]);
    });

    setBatchResults(results);
    setIsRunning(false);
    batchProcessor.clearQueue();
    setBatchQueue([]);
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
        🔑 AUTOMATED ALL KEYS LOST (AKL)
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
          ⚠️ AUTHORIZED USE ONLY
        </h2>
        <p style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
          This tool performs automated key programming operations that bypass manufacturer security.
          Only use with proper authorization, locksmith licensing, and vehicle ownership verification.
          Unauthorized use may violate laws. User assumes all legal responsibility.
        </p>
      </div>

      {/* Mode Selection */}
      <div style={{
        padding: '20px',
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '3px solid #00ff00'
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>Mode Selection</h2>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button
            onClick={() => setMode("single")}
            style={{
              padding: '15px 30px',
              backgroundColor: mode === "single" ? '#00aa00' : '#333',
              color: '#fff',
              border: mode === "single" ? '3px solid #00ff00' : 'none',
              borderRadius: '8px',
              fontSize: '1.1rem',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            🔑 Single Vehicle
          </button>
          <button
            onClick={() => setMode("batch")}
            style={{
              padding: '15px 30px',
              backgroundColor: mode === "batch" ? '#00aa00' : '#333',
              color: '#fff',
              border: mode === "batch" ? '3px solid #00ff00' : 'none',
              borderRadius: '8px',
              fontSize: '1.1rem',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            📋 Batch Processing
          </button>
        </div>
      </div>

      {/* Configuration Panel */}
      <div style={{
        padding: '20px',
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '3px solid #00ff00'
      }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>
          {mode === "single" ? "Vehicle Configuration" : "Add to Batch Queue"}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {/* Manufacturer */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '1.1rem' }}>
              Manufacturer:
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {[
                { id: "vw", label: "🚗 VW/Audi MQB", color: "#0066cc" },
                { id: "gm", label: "🚙 GM/Chevrolet", color: "#cc6600" },
                { id: "bmw", label: "🏎️ BMW CAS3/CAS3+", color: "#0099cc" }
              ].map(({ id, label, color }) => (
                <button
                  key={id}
                  onClick={() => setManufacturer(id as any)}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: manufacturer === id ? color : '#333',
                    color: '#fff',
                    border: manufacturer === id ? '3px solid #00ff00' : 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* VIN */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '1.1rem' }}>
              VIN (17 characters):
            </label>
            <input
              type="text"
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              placeholder="WVWZZZ1KZBW123456"
              maxLength={17}
              style={{
                padding: '12px',
                backgroundColor: '#000',
                color: '#00ff00',
                border: '2px solid #00ff00',
                borderRadius: '6px',
                fontSize: '1.2rem',
                width: '100%',
                fontFamily: 'monospace'
              }}
            />
          </div>

          {/* Key Count */}
          {manufacturer !== "bmw" && (
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '1.1rem' }}>
                Number of Keys to Program:
              </label>
              <input
                type="number"
                value={keyCount}
                onChange={(e) => setKeyCount(parseInt(e.target.value) || 1)}
                min="1"
                max="8"
                style={{
                  padding: '12px',
                  backgroundColor: '#000',
                  color: '#00ff00',
                  border: '2px solid #00ff00',
                  borderRadius: '6px',
                  fontSize: '1.2rem',
                  width: '150px'
                }}
              />
            </div>
          )}

          {/* BMW Method */}
          {manufacturer === "bmw" && (
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '1.1rem' }}>
                Programming Method:
              </label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setMethod("obd")}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: method === "obd" ? '#00aa00' : '#333',
                    color: '#fff',
                    border: method === "obd" ? '3px solid #00ff00' : 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                >
                  OBD (Via Port)
                </button>
                <button
                  onClick={() => setMethod("bench")}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: method === "bench" ? '#00aa00' : '#333',
                    color: '#fff',
                    border: method === "bench" ? '3px solid #00ff00' : 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    cursor: 'pointer'
                  }}
                >
                  Bench (CAS Removed)
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            {mode === "single" ? (
              <button
                onClick={startSingleAKL}
                disabled={isRunning || !vin}
                style={{
                  padding: '15px 40px',
                  backgroundColor: isRunning ? '#666' : '#00aa00',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1.3rem',
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {isRunning ? '⏳ PROCESSING...' : '🚀 START AKL'}
              </button>
            ) : (
              <button
                onClick={addToBatch}
                disabled={!vin}
                style={{
                  padding: '15px 40px',
                  backgroundColor: '#0066aa',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1.3rem',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ➕ ADD TO QUEUE
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Batch Queue */}
      {mode === "batch" && batchQueue.length > 0 && (
        <div style={{
          padding: '20px',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '3px solid #00ff00'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>
            📋 Batch Queue ({batchQueue.length} vehicles)
          </h2>

          <div style={{ marginBottom: '15px' }}>
            {batchQueue.map((item, i) => (
              <div
                key={i}
                style={{
                  padding: '12px',
                  backgroundColor: '#0a0a0a',
                  border: '2px solid #00ff00',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <strong>{item.make}</strong> - {item.vin} ({item.keyCount} key{item.keyCount > 1 ? 's' : ''})
                </div>
                <button
                  onClick={() => removeFromBatch(i)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#aa0000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  ❌
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={processBatch}
            disabled={isRunning}
            style={{
              padding: '15px 40px',
              backgroundColor: isRunning ? '#666' : '#00aa00',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1.3rem',
              cursor: isRunning ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {isRunning ? '⏳ PROCESSING BATCH...' : `🚀 PROCESS ${batchQueue.length} VEHICLE${batchQueue.length > 1 ? 'S' : ''}`}
          </button>
        </div>
      )}

      {/* Progress Display */}
      {progress && (
        <div style={{
          padding: '20px',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '3px solid #ffaa00'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '15px', color: '#ffaa00' }}>
            ⚙️ AKL IN PROGRESS
          </h2>

          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: '10px' }}>
              Step {progress.step} of {progress.totalSteps}: {progress.message}
            </div>
            <div style={{
              width: '100%',
              height: '30px',
              backgroundColor: '#0a0a0a',
              borderRadius: '15px',
              overflow: 'hidden',
              border: '2px solid #ffaa00'
            }}>
              <div style={{
                width: `${progress.percentage}%`,
                height: '100%',
                backgroundColor: '#ffaa00',
                transition: 'width 0.3s'
              }} />
            </div>
            <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '1.1rem' }}>
              {progress.percentage}%
            </div>
          </div>

          <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>
            Status: {progress.status.toUpperCase()}
          </div>
        </div>
      )}

      {/* Result Display */}
      {result && (
        <div style={{
          padding: '20px',
          backgroundColor: result.success ? '#0a2a0a' : '#2a0a0a',
          borderRadius: '8px',
          marginBottom: '20px',
          border: `3px solid ${result.success ? '#00ff00' : '#ff3333'}`
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            marginBottom: '15px',
            color: result.success ? '#00ff00' : '#ff3333'
          }}>
            {result.success ? '✅ AKL COMPLETED SUCCESSFULLY' : '❌ AKL FAILED'}
          </h2>

          <div style={{ fontSize: '1.1rem', lineHeight: '1.8' }}>
            <div><strong>Vehicle:</strong> {result.vehicleInfo.make} {result.vehicleInfo.model}</div>
            <div><strong>VIN:</strong> {result.vehicleInfo.vin}</div>
            <div><strong>Keys Programmed:</strong> {result.keysProgrammed}</div>
            <div><strong>Duration:</strong> {(result.duration / 1000).toFixed(1)} seconds</div>

            {result.errors.length > 0 && (
              <div style={{ marginTop: '15px', color: '#ff3333' }}>
                <strong>Errors:</strong>
                {result.errors.map((err, i) => (
                  <div key={i} style={{ marginLeft: '15px' }}>• {err}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Batch Results */}
      {batchResults.length > 0 && (
        <div style={{
          padding: '20px',
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '3px solid #00ff00'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>
            📊 Batch Results ({batchResults.filter(r => r.success).length}/{batchResults.length} successful)
          </h2>

          {batchResults.map((res, i) => (
            <div
              key={i}
              style={{
                padding: '12px',
                backgroundColor: res.success ? '#0a2a0a' : '#2a0a0a',
                border: `2px solid ${res.success ? '#00ff00' : '#ff3333'}`,
                borderRadius: '6px',
                marginBottom: '8px'
              }}
            >
              {res.success ? '✅' : '❌'} {res.vehicleInfo.vin} - {res.keysProgrammed} keys in {(res.duration / 1000).toFixed(1)}s
            </div>
          ))}
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
