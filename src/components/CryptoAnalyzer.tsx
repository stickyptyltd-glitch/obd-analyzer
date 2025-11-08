/**
 * IMMOBILIZER CRYPTO ANALYZER
 *
 * Break IMMO encryption and crack rolling codes
 */

import { useState } from "react";
import { CryptoAnalysisEngine, type CrackedKey } from "@/lib/cryptoAnalysis";

export default function CryptoAnalyzer() {
  const [engine] = useState(() => new CryptoAnalysisEngine());
  const [crackedKeys, setCrackedKeys] = useState<CrackedKey[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  const [challenge, setChallenge] = useState("");
  const [response, setResponse] = useState("");
  const [algorithm, setAlgorithm] = useState<"hitag2" | "keeloq" | "megamos">("hitag2");

  const [vin, setVin] = useState("");
  const [csData, setCsData] = useState("");

  const [rollingCodes, setRollingCodes] = useState("");
  const [predictedCode, setPredictedCode] = useState<number | null>(null);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-50));
  };

  const crackKey = async () => {
    if (!challenge || !response) {
      addLog("❌ Enter challenge and response");
      return;
    }

    addLog(`Analyzing ${algorithm.toUpperCase()} challenge-response...`);

    let result: CrackedKey | null = null;

    if (algorithm === "hitag2") {
      result = await engine.crackHitag2(challenge, response);
    } else if (algorithm === "megamos") {
      result = await engine.crackMegamosCrypto(challenge, response);
    }

    if (result) {
      setCrackedKeys(prev => [...prev, result!]);
      addLog(`✅ KEY CRACKED: ${result.key}`);
      addLog(`Method: ${result.method} | Confidence: ${(result.confidence * 100).toFixed(0)}%`);
      addLog(`Attempts: ${result.attempts} | Duration: ${result.duration}ms`);
    } else {
      addLog("❌ Failed to crack key");
    }
  };

  const calculateDealerKey = async () => {
    if (!csData || !vin) {
      addLog("❌ Enter CS data and VIN");
      return;
    }

    addLog("Calculating VW dealer key...");
    const dealerKey = await engine.calculateVWDealerKey(csData, vin);
    addLog(`✅ Dealer Key: ${dealerKey}`);
  };

  const predictRolling = async () => {
    const codes = rollingCodes.split(',').map(c => parseInt(c.trim(), 16)).filter(c => !isNaN(c));

    if (codes.length < 3) {
      addLog("❌ Enter at least 3 rolling codes (comma-separated hex)");
      return;
    }

    addLog("Analyzing rolling code sequence...");
    const next = await engine.predictRollingCode({
      fixedCode: "0000",
      observedCodes: codes,
      algorithm: "unknown"
    });

    if (next !== null) {
      setPredictedCode(next);
      addLog(`✅ Predicted Next Code: 0x${next.toString(16).toUpperCase()}`);
    } else {
      addLog("❌ Unable to determine pattern");
    }
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#0a0a0a', color: '#00ff00', fontFamily: 'monospace', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '20px' }}>🔐 IMMOBILIZER CRYPTO ANALYZER</h1>

      {/* Challenge-Response Cracking */}
      <div style={{ padding: '20px', backgroundColor: '#1a1a1a', borderRadius: '8px', marginBottom: '20px', border: '3px solid #ff0066' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '15px', color: '#ff0066' }}>⚡ Challenge-Response Attack</h2>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Algorithm:</label>
          <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value as any)} style={{ padding: '8px', backgroundColor: '#000', color: '#00ff00', border: '2px solid #ff0066', borderRadius: '4px', fontSize: '1rem', marginBottom: '10px' }}>
            <option value="hitag2">Hitag2 (PCF7935)</option>
            <option value="keeloq">KeeLoq</option>
            <option value="megamos">Megamos Crypto</option>
          </select>

          <label style={{ display: 'block', marginBottom: '5px' }}>Challenge (hex):</label>
          <input type="text" value={challenge} onChange={(e) => setChallenge(e.target.value.toUpperCase())} placeholder="DEADBEEF" style={{ padding: '8px', backgroundColor: '#000', color: '#00ff00', border: '2px solid #ff0066', borderRadius: '4px', fontSize: '1rem', width: '300px', marginBottom: '10px', fontFamily: 'monospace' }} />

          <label style={{ display: 'block', marginBottom: '5px' }}>Response (hex):</label>
          <input type="text" value={response} onChange={(e) => setResponse(e.target.value.toUpperCase())} placeholder="CAFEBABE" style={{ padding: '8px', backgroundColor: '#000', color: '#00ff00', border: '2px solid #ff0066', borderRadius: '4px', fontSize: '1rem', width: '300px', marginBottom: '10px', fontFamily: 'monospace' }} />
        </div>

        <button onClick={crackKey} style={{ padding: '12px 24px', backgroundColor: '#ff0066', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '1.1rem', cursor: 'pointer' }}>⚡ CRACK KEY</button>
      </div>

      {/* VW Dealer Key */}
      <div style={{ padding: '20px', backgroundColor: '#1a1a1a', borderRadius: '8px', marginBottom: '20px', border: '3px solid #0066ff' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '15px', color: '#0066ff' }}>🔮 VW/Audi Dealer Key Generator</h2>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>CS Data (Component Security):</label>
          <input type="text" value={csData} onChange={(e) => setCsData(e.target.value.toUpperCase())} placeholder="01234567890ABCDEF..." style={{ padding: '8px', backgroundColor: '#000', color: '#00ff00', border: '2px solid #0066ff', borderRadius: '4px', fontSize: '1rem', width: '400px', marginBottom: '10px', fontFamily: 'monospace' }} />

          <label style={{ display: 'block', marginBottom: '5px' }}>VIN:</label>
          <input type="text" value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} placeholder="WVWZZZ1KZBW123456" maxLength={17} style={{ padding: '8px', backgroundColor: '#000', color: '#00ff00', border: '2px solid #0066ff', borderRadius: '4px', fontSize: '1rem', width: '300px', fontFamily: 'monospace' }} />
        </div>

        <button onClick={calculateDealerKey} style={{ padding: '12px 24px', backgroundColor: '#0066ff', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '1.1rem', cursor: 'pointer' }}>🔮 Calculate Dealer Key</button>
      </div>

      {/* Rolling Code Prediction */}
      <div style={{ padding: '20px', backgroundColor: '#1a1a1a', borderRadius: '8px', marginBottom: '20px', border: '3px solid #00ff66' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '15px', color: '#00ff66' }}>📊 Rolling Code Predictor</h2>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Observed Rolling Codes (hex, comma-separated):</label>
          <input type="text" value={rollingCodes} onChange={(e) => setRollingCodes(e.target.value)} placeholder="1A2B, 1A2C, 1A2D, ..." style={{ padding: '8px', backgroundColor: '#000', color: '#00ff00', border: '2px solid #00ff66', borderRadius: '4px', fontSize: '1rem', width: '100%', marginBottom: '10px', fontFamily: 'monospace' }} />
        </div>

        <button onClick={predictRolling} style={{ padding: '12px 24px', backgroundColor: '#00ff66', color: '#000', border: 'none', borderRadius: '6px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold', marginBottom: '15px' }}>📊 Predict Next Code</button>

        {predictedCode !== null && (
          <div style={{ padding: '15px', backgroundColor: '#003d00', border: '2px solid #00ff66', borderRadius: '6px' }}>
            <strong>Predicted Next Code:</strong> 0x{predictedCode.toString(16).toUpperCase().padStart(8, '0')}
          </div>
        )}
      </div>

      {/* Cracked Keys */}
      {crackedKeys.length > 0 && (
        <div style={{ padding: '20px', backgroundColor: '#1a1a1a', borderRadius: '8px', marginBottom: '20px', border: '3px solid #00ff00' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>🔑 Cracked Keys ({crackedKeys.length})</h2>
          {crackedKeys.map((key, i) => (
            <div key={i} style={{ padding: '12px', backgroundColor: '#0a2a0a', border: '2px solid #00ff00', borderRadius: '6px', marginBottom: '8px' }}>
              <div><strong>Key #{i + 1}:</strong> {key.key}</div>
              <div>Algorithm: {key.algorithm.toUpperCase()} | Method: {key.method} | Confidence: {(key.confidence * 100).toFixed(0)}%</div>
              <div>Attempts: {key.attempts} | Duration: {key.duration}ms</div>
            </div>
          ))}
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
