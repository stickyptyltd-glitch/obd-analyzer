import React, { useState, useRef, useEffect } from "react";
import Papa from "papaparse";
import { canonPid } from "@/lib/pidMapper";
import { avg, max, min } from "@/lib/statistics";
import { analyzeTrends, detectComplexPatterns, correlateSymptoms, type PatternMatch, type TrendAnalysis } from "@/lib/advancedPatternAnalysis";

type SimpleRow = {
  timeRaw: number;
  pid: string;
  value: number | null;
  file: string;
};

type DiagnosticSession = {
  id: string;
  timestamp: string;
  files: string[];
  findings: string[];
  dataPoints: number;
  uniquePIDs: number;
};

export default function MinimalOBD() {
  const [status, setStatus] = useState("No files uploaded yet");
  const [results, setResults] = useState<string[]>([]);
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [patterns, setPatterns] = useState<PatternMatch[]>([]);
  const [trends, setTrends] = useState<TrendAnalysis[]>([]);
  const [correlations, setCorrelations] = useState<string[]>([]);
  const [history, setHistory] = useState<DiagnosticSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('obd-diagnostic-history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load history:', e);
      }
    }
  }, []);

  // Save to localStorage whenever history changes
  const saveSession = (session: DiagnosticSession) => {
    const updated = [session, ...history].slice(0, 50); // Keep last 50 sessions
    setHistory(updated);
    localStorage.setItem('obd-diagnostic-history', JSON.stringify(updated));
  };

  const toNumber = (n: any): number | null => {
    if (n == null || n === "") return null;
    const f = Number(String(n).replace(/,/g, ""));
    return Number.isFinite(f) ? f : null;
  };

  const parseBRCFile = async (file: File): Promise<string> => {
    // .brc is a proprietary binary format from Car Scanner
    // We'll try multiple approaches to extract data

    try {
      // First, try reading as text (some .brc files are just renamed CSV)
      const text = await file.text();

      // Check if it looks like CSV
      if (text.includes(',') && (text.includes('time') || text.includes('Time') || text.includes('PID'))) {
        return text; // It's CSV data
      }

      // If not CSV, try reading as binary and look for patterns
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // Try to extract ASCII strings from binary (common PIDs, timestamps)
      let extractedText = '';
      let currentString = '';

      for (let i = 0; i < bytes.length; i++) {
        const byte = bytes[i];
        // ASCII printable characters
        if (byte >= 32 && byte <= 126) {
          currentString += String.fromCharCode(byte);
        } else {
          if (currentString.length > 3) {
            extractedText += currentString + '\n';
          }
          currentString = '';
        }
      }

      // If we found structured text, return it
      if (extractedText.length > 100) {
        return extractedText;
      }

      // If all else fails, return error message
      return `FORMAT_ERROR: Unable to parse .brc binary format. Please export to CSV from Car Scanner app.`;

    } catch (error) {
      return `FORMAT_ERROR: ${error}`;
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      setStatus("No files selected");
      return;
    }

    setStatus(`Processing ${files.length} file(s)...`);
    setResults([]);
    setDiagnostics([]);

    try {
      const fileResults: string[] = [];
      const allData: SimpleRow[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isBRC = file.name.toLowerCase().endsWith('.brc');

        setStatus(`📂 Reading file ${i + 1}/${files.length}: ${file.name}${isBRC ? ' (BRC format)' : ''}`);

        let text: string;

        if (isBRC) {
          setStatus(`🔓 Attempting to parse .brc file...`);
          text = await parseBRCFile(file);

          if (text.startsWith('FORMAT_ERROR:')) {
            fileResults.push(`❌ ${file.name}: ${text}`);
            fileResults.push('   💡 Tip: Export to CSV from Car Scanner app for full compatibility');
            fileResults.push('');
            continue;
          }
        } else {
          text = await file.text();
        }

        const lines = text.split('\n');

        fileResults.push(`✅ File: ${file.name}`);
        fileResults.push(`   Size: ${(file.size / 1024).toFixed(1)} KB`);
        fileResults.push(`   Lines: ${lines.length}`);

        // Parse CSV
        setStatus(`📊 Parsing ${file.name}...`);
        const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

        if (parsed.meta?.fields && parsed.data) {
          const cols = parsed.meta.fields;
          const rows = parsed.data as any[];
          const timeCol = cols.find(c => ["time", "timestamp", "seconds"].includes(c.toLowerCase())) || cols[0];

          // Limit to 2000 rows per file
          const maxRows = Math.min(rows.length, 2000);

          for (let r = 0; r < maxRows; r++) {
            const row = rows[r];
            const timeVal = toNumber(row[timeCol]) ?? r;

            for (const col of cols) {
              if (col === timeCol) continue;
              const pid = canonPid(col);
              const val = toNumber(row[col]);

              if (val != null) {
                allData.push({ timeRaw: timeVal, pid, value: val, file: file.name });
              }
            }
          }

          fileResults.push(`   Parsed: ${maxRows} rows, ${cols.length} columns`);
        }

        fileResults.push('');
      }

      setResults(fileResults);

      // Run advanced diagnostics
      if (allData.length > 0) {
        setStatus(`🔍 Step 1/4: Running comprehensive diagnostics...`);
        const diag = runAdvancedDiagnostics(allData);
        setDiagnostics(diag);

        setStatus(`🔍 Step 2/4: Analyzing trends...`);
        const cleanData = allData.filter(d => d.value !== null) as any[]; // Filter null values
        const trendData = analyzeTrends(cleanData);
        setTrends(trendData);

        setStatus(`🔍 Step 3/4: Detecting fault patterns...`);
        const patternMatches = detectComplexPatterns(cleanData, trendData);
        setPatterns(patternMatches);

        setStatus(`🔍 Step 4/4: Correlating symptoms...`);
        const symptomCorrelations = correlateSymptoms(cleanData);
        setCorrelations(symptomCorrelations);

        setStatus(`✅ Complete! Found ${diag.length} findings, ${patternMatches.length} patterns, ${trendData.length} trends.`);

        // Save session to history
        const session: DiagnosticSession = {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleString(),
          files: Array.from(files).map(f => f.name),
          findings: [...diag, ...symptomCorrelations],
          dataPoints: allData.length,
          uniquePIDs: new Set(allData.map(d => d.pid)).size
        };
        saveSession(session);
      } else {
        setStatus(`✅ Files read but no data found.`);
      }

    } catch (error) {
      setStatus(`❌ Error: ${error}`);
    }
  };

  const runAdvancedDiagnostics = (data: SimpleRow[]): string[] => {
    const findings: string[] = [];

    // Get values for each sensor
    const getValue = (pid: string) => data.filter(d => d.pid === pid).map(d => d.value!);
    const getValueWithTime = (pid: string) => data.filter(d => d.pid === pid).map(d => ({ t: d.timeRaw, v: d.value! }));

    // === CORE ENGINE DIAGNOSTICS ===

    const coolant = getValue("Engine coolant temperature");
    const rpm = getValue("Engine RPM");
    const speed = getValue("Vehicle speed");
    const voltage = getValue("Control module voltage");
    const stft = getValue("STFT");
    const ltft = getValue("LTFT");
    const maf = getValue("MAF air flow rate");
    const iat = getValue("Intake air temperature");
    const throttle = getValue("Throttle position");
    const timing = getValue("Timing advance");
    const o2_b1s1 = getValue("O2 Bank 1 Sensor 1");
    const o2_b1s2 = getValue("O2 Bank 1 Sensor 2");

    // 1. Coolant Temperature Analysis
    if (coolant.length > 0) {
      const maxCoolant = max(coolant);
      const avgCoolant = avg(coolant);
      if (maxCoolant && maxCoolant < 80) {
        findings.push(`🟡 THERMOSTAT: Low coolant temp (${maxCoolant.toFixed(0)}°C) - thermostat stuck open or faulty`);
      }
      if (maxCoolant && maxCoolant > 105) {
        findings.push(`🔴 COOLING SYSTEM: High coolant temp (${maxCoolant.toFixed(0)}°C) - overheating risk!`);
      }
      if (avgCoolant && avgCoolant > 95 && avgCoolant < 105) {
        findings.push(`🟡 COOLING: Running hot avg=${avgCoolant.toFixed(0)}°C - check coolant level, fan operation`);
      }
    }

    // 2. Battery/Charging System
    if (voltage.length > 0) {
      const minVolt = min(voltage);
      const maxVolt = max(voltage);
      const avgVolt = avg(voltage);

      if (minVolt && minVolt < 12) {
        findings.push(`🔴 BATTERY: Low voltage (${minVolt.toFixed(1)}V) - battery failing or charging system fault`);
      }
      if (maxVolt && maxVolt > 15) {
        findings.push(`🔴 ALTERNATOR: Overcharging detected (${maxVolt.toFixed(1)}V) - voltage regulator failure`);
      }
      if (avgVolt && avgVolt < 13.5) {
        findings.push(`🟡 CHARGING: Average voltage low (${avgVolt.toFixed(1)}V) - alternator may be weak`);
      }
    }

    // 3. Fuel Trim Analysis (Advanced)
    if (stft.length > 0 || ltft.length > 0) {
      const avgSTFT = stft.length > 0 ? avg(stft) : 0;
      const avgLTFT = ltft.length > 0 ? avg(ltft) : 0;
      const totalTrim = (avgSTFT || 0) + (avgLTFT || 0);

      if (avgSTFT && Math.abs(avgSTFT) > 15) {
        findings.push(`🔴 FUEL SYSTEM: Extreme STFT (${avgSTFT.toFixed(1)}%) - immediate attention needed`);
      } else if (avgSTFT && Math.abs(avgSTFT) > 10) {
        findings.push(`🟡 FUEL TRIM: High STFT (${avgSTFT.toFixed(1)}%) - vacuum leak, MAF, or injector issue`);
      }

      if (avgLTFT && Math.abs(avgLTFT) > 15) {
        findings.push(`🔴 FUEL SYSTEM: Extreme LTFT (${avgLTFT.toFixed(1)}%) - persistent fuel delivery problem`);
      } else if (avgLTFT && Math.abs(avgLTFT) > 10) {
        findings.push(`🟡 FUEL TRIM: High LTFT (${avgLTFT.toFixed(1)}%) - long-term mixture compensation active`);
      }

      if (Math.abs(totalTrim) > 20) {
        findings.push(`🔴 FUEL SYSTEM: Combined trim excessive (${totalTrim.toFixed(1)}%) - major fuel system fault`);
      }
    }

    // 4. MAF Sensor Analysis
    if (maf.length > 0 && rpm.length > 0) {
      const avgMAF = avg(maf);
      const maxMAF = max(maf);

      if (avgMAF && avgMAF < 2) {
        findings.push(`🟡 MAF SENSOR: Low airflow reading (${avgMAF.toFixed(2)} g/s) - dirty/faulty MAF sensor`);
      }
      if (maxMAF && maxMAF > 200) {
        findings.push(`🟡 MAF SENSOR: Very high airflow (${maxMAF.toFixed(0)} g/s) - possible MAF sensor fault`);
      }
    }

    // 5. O2 Sensor Analysis
    if (o2_b1s1.length > 0) {
      const avgO2 = avg(o2_b1s1);
      const minO2 = min(o2_b1s1);
      const maxO2 = max(o2_b1s1);

      if (minO2 !== null && maxO2 !== null && (maxO2 - minO2) < 0.3) {
        findings.push(`🟡 O2 SENSOR: Bank 1 Sensor 1 not switching properly - sensor aging or exhaust leak`);
      }
      if (avgO2 && avgO2 > 0.9) {
        findings.push(`🟡 O2 SENSOR: B1S1 reading lean (${avgO2.toFixed(2)}V) - vacuum leak or weak fuel pressure`);
      }
      if (avgO2 && avgO2 < 0.1) {
        findings.push(`🟡 O2 SENSOR: B1S1 reading rich (${avgO2.toFixed(2)}V) - injector leak or high fuel pressure`);
      }
    }

    // 6. Throttle Position Sensor
    if (throttle.length > 0) {
      const minThrottle = min(throttle);
      const maxThrottle = max(throttle);

      if (minThrottle && minThrottle > 5) {
        findings.push(`🟡 TPS: Idle position high (${minThrottle.toFixed(1)}%) - throttle body needs cleaning or TPS fault`);
      }
      if (maxThrottle && maxThrottle < 80) {
        findings.push(`🟡 TPS: Max throttle not reached (${maxThrottle.toFixed(0)}%) - check throttle cable or pedal sensor`);
      }
    }

    // 7. Intake Air Temperature
    if (iat.length > 0) {
      const avgIAT = avg(iat);
      const maxIAT = max(iat);

      if (maxIAT && maxIAT > 60) {
        findings.push(`🟡 INTAKE: High air temp (${maxIAT.toFixed(0)}°C) - heat soak, check intake/intercooler`);
      }
      if (avgIAT && avgIAT < -10) {
        findings.push(`🟡 IAT SENSOR: Unusually cold reading (${avgIAT.toFixed(0)}°C) - sensor may be faulty`);
      }
    }

    // 8. Timing Advance
    if (timing.length > 0 && rpm.length > 0) {
      const avgTiming = avg(timing);
      const minTiming = min(timing);

      if (minTiming && minTiming < 0) {
        findings.push(`🟡 IGNITION: Timing retard detected (${minTiming.toFixed(1)}°) - knock detected or bad fuel`);
      }
      if (avgTiming && avgTiming < 10) {
        findings.push(`🟡 IGNITION: Low timing advance (${avgTiming.toFixed(1)}°) - knock sensor active or timing issue`);
      }
    }

    // 9. RPM and Speed Correlation
    if (rpm.length > 50 && speed.length > 50) {
      const maxRPM = max(rpm);
      const maxSpeed = max(speed);

      findings.push(`ℹ️ PERFORMANCE: Max RPM ${maxRPM?.toFixed(0) || 'N/A'}, Max Speed ${maxSpeed?.toFixed(0) || 'N/A'} km/h`);

      // Check for unusual RPM patterns
      const highRPMCount = rpm.filter(r => r > 4000).length;
      if (highRPMCount > rpm.length * 0.3) {
        findings.push(`ℹ️ DRIVING STYLE: High RPM usage detected (${((highRPMCount/rpm.length)*100).toFixed(0)}% above 4000 RPM)`);
      }
    }

    // 10. Misfire Detection
    const misfireData = getValue("Misfire count");
    const misfireCyl1 = getValue("Cylinder 1 misfire");
    const misfireCyl2 = getValue("Cylinder 2 misfire");
    const misfireCyl3 = getValue("Cylinder 3 misfire");
    const misfireCyl4 = getValue("Cylinder 4 misfire");

    if (misfireData.length > 0) {
      const totalMisfires = misfireData.reduce((sum, val) => sum + val, 0);
      if (totalMisfires > 0) {
        findings.push(`🔴 MISFIRE: Detected ${totalMisfires} total misfires - check spark plugs, coils, injectors`);
      }
    }

    [misfireCyl1, misfireCyl2, misfireCyl3, misfireCyl4].forEach((cylMisfires, idx) => {
      if (cylMisfires.length > 0 && max(cylMisfires)! > 5) {
        findings.push(`🔴 CYLINDER ${idx + 1}: ${max(cylMisfires)} misfires detected - specific cylinder issue`);
      }
    });

    // 11. Engine Load vs Throttle Correlation
    const engineLoad = getValue("Engine load");
    if (engineLoad.length > 0 && throttle.length > 0) {
      const avgLoad = avg(engineLoad);
      const avgThrottle = avg(throttle);

      if (avgLoad && avgThrottle && avgLoad > 80 && avgThrottle < 50) {
        findings.push(`🟡 LOAD/THROTTLE: High load (${avgLoad.toFixed(0)}%) at low throttle (${avgThrottle.toFixed(0)}%) - possible restriction or turbo issue`);
      }

      const maxLoad = max(engineLoad);
      if (maxLoad && maxLoad > 95) {
        findings.push(`ℹ️ LOAD: Peak engine load ${maxLoad.toFixed(0)}% - vehicle under heavy load/acceleration`);
      }
    }

    // 12. Catalyst Efficiency
    const o2_upstream = getValue("O2 Bank 1 Sensor 1");
    const o2_downstream = getValue("O2 Bank 1 Sensor 2");

    if (o2_upstream.length > 0 && o2_downstream.length > 0) {
      const upstreamRange = (max(o2_upstream) || 0) - (min(o2_upstream) || 0);
      const downstreamRange = (max(o2_downstream) || 0) - (min(o2_downstream) || 0);

      if (downstreamRange > 0.5) {
        findings.push(`🟡 CATALYST: Downstream O2 switching excessively (${downstreamRange.toFixed(2)}V range) - catalyst efficiency low`);
      }

      if (upstreamRange < 0.3) {
        findings.push(`🟡 O2 SENSOR: Upstream sensor not switching properly - sensor aging or stuck`);
      }
    }

    // 13. Transmission Analysis
    const transmissionTemp = getValue("Transmission fluid temperature");
    const gearPosition = getValue("Gear position");
    const torqueConverterSlip = getValue("Torque converter slip");

    if (transmissionTemp.length > 0) {
      const maxTransTemp = max(transmissionTemp);
      const avgTransTemp = avg(transmissionTemp);

      if (maxTransTemp && maxTransTemp > 115) {
        findings.push(`🔴 TRANSMISSION: Fluid temp very high (${maxTransTemp.toFixed(0)}°C) - risk of damage!`);
      } else if (avgTransTemp && avgTransTemp > 100) {
        findings.push(`🟡 TRANSMISSION: Elevated fluid temp (${avgTransTemp.toFixed(0)}°C avg) - check cooler, fluid level`);
      }
    }

    if (torqueConverterSlip.length > 0) {
      const avgSlip = avg(torqueConverterSlip);
      const maxSlip = max(torqueConverterSlip);

      if (maxSlip && maxSlip > 50) {
        findings.push(`🔴 TORQUE CONVERTER: Excessive slip (${maxSlip.toFixed(0)} RPM) - converter failing or low fluid`);
      } else if (avgSlip && avgSlip > 20) {
        findings.push(`🟡 TORQUE CONVERTER: Elevated slip (${avgSlip.toFixed(0)} RPM avg) - monitor for progression`);
      }
    }

    // 14. Fuel System Efficiency
    if (maf.length > 0 && rpm.length > 0 && speed.length > 0) {
      // Calculate approximate fuel consumption based on MAF and speed
      const avgMAF = avg(maf);
      const avgSpeed = avg(speed.filter(s => s > 5)); // Only when moving

      if (avgMAF && avgSpeed && avgSpeed > 0) {
        const approxFuelRate = avgMAF / avgSpeed; // Rough efficiency metric
        if (approxFuelRate > 5) {
          findings.push(`🟡 FUEL EFFICIENCY: High fuel consumption detected - check driving style, tire pressure, air filter`);
        }
      }
    }

    // 15. Boost Pressure (Turbocharged vehicles)
    const boostPressure = getValue("Boost pressure");
    const intakeManifoldPressure = getValue("Intake manifold pressure");

    if (boostPressure.length > 0) {
      const maxBoost = max(boostPressure);
      const avgBoost = avg(boostPressure);

      if (maxBoost && maxBoost > 25) {
        findings.push(`🟡 TURBO: High boost pressure (${maxBoost.toFixed(1)} psi) - verify boost control, check for overboost`);
      }
      if (avgBoost && avgBoost < -5 && throttle.length > 0 && avg(throttle)! > 20) {
        findings.push(`🟡 TURBO: Negative boost under throttle - possible boost leak or wastegate stuck open`);
      }
    }

    // 16. Knock/Detonation Detection
    const knockRetard = getValue("Knock retard");
    const knockSensor = getValue("Knock sensor");

    if (knockRetard.length > 0) {
      const maxKnockRetard = max(knockRetard);
      if (maxKnockRetard && Math.abs(maxKnockRetard) > 3) {
        findings.push(`🔴 KNOCK: Significant timing retard (${maxKnockRetard.toFixed(1)}°) - use higher octane fuel or check for carbon buildup`);
      }
    }

    // 17. Sensor Correlation Analysis
    if (iat.length > 0 && coolant.length > 0) {
      const avgIAT = avg(iat);
      const avgCoolant = avg(coolant);

      if (avgIAT && avgCoolant && avgIAT > avgCoolant + 10) {
        findings.push(`ℹ️ SENSORS: IAT higher than coolant - normal for forced induction or hot ambient conditions`);
      }
      if (avgIAT && avgCoolant && avgIAT < avgCoolant - 20) {
        findings.push(`🟡 IAT SENSOR: IAT much lower than coolant - sensor may be reading incorrectly`);
      }
    }

    // 18. DPF/Emissions System (Diesel)
    const dpfPressure = getValue("DPF pressure");
    const dpfTemp = getValue("DPF temperature");
    const sootLoad = getValue("Soot load");

    if (dpfPressure.length > 0) {
      const avgDPFPressure = avg(dpfPressure);
      if (avgDPFPressure && avgDPFPressure > 150) {
        findings.push(`🔴 DPF: High backpressure (${avgDPFPressure.toFixed(0)} kPa) - DPF clogged, regeneration needed`);
      }
    }

    if (sootLoad.length > 0) {
      const currentSoot = sootLoad[sootLoad.length - 1];
      if (currentSoot > 80) {
        findings.push(`🟡 DPF: High soot load (${currentSoot.toFixed(0)}%) - schedule regeneration or service`);
      }
    }

    // 19. Data Quality Check
    const uniquePIDs = new Set(data.map(d => d.pid)).size;
    findings.push(`ℹ️ DATA: Analyzed ${data.length} data points across ${uniquePIDs} parameters`);

    if (findings.filter(f => f.includes('🔴')).length === 0 && findings.filter(f => f.includes('🟡')).length === 0) {
      findings.unshift(`✅ SYSTEM HEALTH: No issues detected! Vehicle operating within normal parameters.`);
    }

    return findings;
  };

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      margin: 0,
      padding: '20px',
      backgroundColor: '#1a1a2e',
      color: '#fff',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '40px',
        backgroundColor: '#16213e',
        borderRadius: '20px'
      }}>
        <h1 style={{ fontSize: '2.5rem', color: '#00d4ff', marginBottom: '20px' }}>
          🚗 OBD File Reader
        </h1>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv,.zip,.txt,.brc"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              flex: 1,
              padding: '40px',
              fontSize: '2rem',
              fontWeight: 'bold',
              backgroundColor: '#0f4c75',
              color: '#fff',
              border: '4px solid #00d4ff',
              borderRadius: '15px',
              cursor: 'pointer'
            }}
          >
            📁 SELECT FILES
          </button>

          <button
            onClick={() => setShowHistory(!showHistory)}
            style={{
              padding: '40px 30px',
              fontSize: '1.8rem',
              fontWeight: 'bold',
              backgroundColor: showHistory ? '#3d0f3d' : '#1a0f3d',
              color: '#fff',
              border: `4px solid ${showHistory ? '#ff00ff' : '#9933ff'}`,
              borderRadius: '15px',
              cursor: 'pointer'
            }}
          >
            📚 {history.length}
          </button>
        </div>

        <div style={{
          padding: '30px',
          backgroundColor: '#0f3460',
          borderRadius: '10px',
          fontSize: '1.3rem',
          marginBottom: '20px',
          border: '2px solid #00d4ff'
        }}>
          {status}
        </div>

        {showHistory && history.length > 0 && (
          <div style={{
            padding: '30px',
            backgroundColor: '#1a0f3d',
            borderRadius: '10px',
            border: '3px solid #9933ff',
            marginBottom: '20px',
            maxHeight: '600px',
            overflowY: 'auto'
          }}>
            <h3 style={{ color: '#ff00ff', fontSize: '1.8rem', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              📚 Diagnostic History
              <button
                onClick={() => {
                  if (confirm('Clear all diagnostic history?')) {
                    setHistory([]);
                    localStorage.removeItem('obd-diagnostic-history');
                  }
                }}
                style={{
                  padding: '10px 20px',
                  fontSize: '1rem',
                  backgroundColor: '#660000',
                  color: '#fff',
                  border: '2px solid #ff0000',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                🗑️ Clear
              </button>
            </h3>

            {history.map((session, idx) => (
              <div key={session.id} style={{
                padding: '20px',
                marginBottom: '15px',
                backgroundColor: '#0f1f3d',
                borderRadius: '8px',
                borderLeft: '5px solid #9933ff'
              }}>
                <div style={{ marginBottom: '10px', fontSize: '0.9rem', color: '#aaa' }}>
                  <strong style={{ color: '#ff00ff' }}>Session #{history.length - idx}</strong> - {session.timestamp}
                </div>
                <div style={{ marginBottom: '10px', fontSize: '0.9rem' }}>
                  📁 Files: {session.files.join(', ')}
                </div>
                <div style={{ marginBottom: '10px', fontSize: '0.9rem' }}>
                  📊 {session.dataPoints} data points, {session.uniquePIDs} PIDs
                </div>
                <div style={{ marginTop: '15px' }}>
                  {session.findings.slice(0, 5).map((finding, i) => (
                    <div key={i} style={{
                      padding: '10px',
                      marginBottom: '5px',
                      backgroundColor: finding.includes('🔴') ? '#3d0f0f' : finding.includes('🟡') ? '#3d2e0f' : '#0f1f3d',
                      borderRadius: '5px',
                      fontSize: '0.9rem',
                      borderLeft: `3px solid ${finding.includes('🔴') ? '#ff3333' : finding.includes('🟡') ? '#ffaa00' : '#33aaff'}`
                    }}>
                      {finding}
                    </div>
                  ))}
                  {session.findings.length > 5 && (
                    <div style={{ marginTop: '10px', fontSize: '0.85rem', color: '#888' }}>
                      ... and {session.findings.length - 5} more findings
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {results.length > 0 && (
          <div style={{
            padding: '20px',
            backgroundColor: '#0f3d1f',
            borderRadius: '10px',
            border: '2px solid #00ff66',
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            lineHeight: '1.8',
            marginBottom: '20px'
          }}>
            {results.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}

        {/* Predictive Fault Patterns - CRITICAL PRIORITY */}
        {patterns.length > 0 && (
          <div style={{
            padding: '30px',
            backgroundColor: '#3d0f0f',
            borderRadius: '10px',
            border: '5px solid #ff3333',
            marginBottom: '20px',
            animation: 'pulse 2s infinite'
          }}>
            <h3 style={{ color: '#ff3333', fontSize: '2rem', marginBottom: '20px', fontWeight: 'bold' }}>
              ⚠️ PREDICTIVE FAULT ANALYSIS - IMMEDIATE ATTENTION
            </h3>
            {patterns.map((pattern, i) => (
              <div key={i} style={{
                padding: '25px',
                marginBottom: '15px',
                backgroundColor: '#1f0f0f',
                borderRadius: '10px',
                border: `4px solid ${
                  pattern.urgency === 'critical' ? '#ff0000' :
                  pattern.urgency === 'high' ? '#ff6600' :
                  pattern.urgency === 'medium' ? '#ffaa00' : '#ffdd00'
                }`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#ff3333' }}>
                    {pattern.likelyRoot}
                  </div>
                  <div style={{
                    padding: '5px 15px',
                    backgroundColor: pattern.urgency === 'critical' ? '#ff0000' :
                                   pattern.urgency === 'high' ? '#ff6600' :
                                   pattern.urgency === 'medium' ? '#ffaa00' : '#ffdd00',
                    color: '#fff',
                    borderRadius: '5px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    fontSize: '0.9rem'
                  }}>
                    {pattern.urgency}
                  </div>
                </div>

                <div style={{
                  padding: '15px',
                  backgroundColor: '#0f0f0f',
                  borderRadius: '8px',
                  marginBottom: '15px',
                  border: '2px solid #ff6600'
                }}>
                  <div style={{ color: '#ff6600', fontWeight: 'bold', marginBottom: '10px', fontSize: '1.1rem' }}>
                    🔮 PREDICTION:
                  </div>
                  <div style={{ color: '#fff', fontSize: '1.1rem', lineHeight: '1.6' }}>
                    {pattern.predictedFailure}
                  </div>
                  {pattern.timeToFailure && (
                    <div style={{ marginTop: '10px', color: '#ff3333', fontWeight: 'bold', fontSize: '1.1rem' }}>
                      ⏰ Estimated Time to Failure: {pattern.timeToFailure}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <div style={{ color: '#ffaa00', fontWeight: 'bold', marginBottom: '8px' }}>
                    Detected Symptoms:
                  </div>
                  <ul style={{ paddingLeft: '20px', lineHeight: '1.8', color: '#ddd' }}>
                    {pattern.symptoms.map((symptom, idx) => (
                      <li key={idx}>{symptom}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ fontSize: '0.9rem', color: '#aaa' }}>
                  <strong style={{ color: '#00d4ff' }}>Related Parameters:</strong> {pattern.relatedPIDs.join(', ')}
                </div>

                <div style={{
                  marginTop: '15px',
                  padding: '10px',
                  backgroundColor: '#0f1f0f',
                  borderRadius: '5px',
                  fontSize: '0.9rem',
                  color: '#00ff66'
                }}>
                  Confidence: {(pattern.confidence * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Symptom Correlations */}
        {correlations.length > 0 && (
          <div style={{
            padding: '25px',
            backgroundColor: '#1f0f1f',
            borderRadius: '10px',
            border: '3px solid #ff00ff',
            marginBottom: '20px'
          }}>
            <h3 style={{ color: '#ff00ff', fontSize: '1.6rem', marginBottom: '15px' }}>
              🔗 Multi-Parameter Correlations
            </h3>
            {correlations.map((corr, i) => (
              <div key={i} style={{
                padding: '12px',
                marginBottom: '8px',
                backgroundColor: '#0f0f1f',
                borderRadius: '6px',
                borderLeft: `4px solid ${corr.includes('🔴') ? '#ff3333' : '#ffaa00'}`,
                fontSize: '1rem',
                lineHeight: '1.6'
              }}>
                {corr}
              </div>
            ))}
          </div>
        )}

        {/* Trend Analysis */}
        {trends.filter(t => t.prediction).length > 0 && (
          <div style={{
            padding: '25px',
            backgroundColor: '#0f1f1f',
            borderRadius: '10px',
            border: '3px solid #9933ff',
            marginBottom: '20px'
          }}>
            <h3 style={{ color: '#9933ff', fontSize: '1.6rem', marginBottom: '15px' }}>
              📈 Trend Analysis & Predictions
            </h3>
            {trends.filter(t => t.prediction).map((trend, i) => (
              <div key={i} style={{
                padding: '15px',
                marginBottom: '10px',
                backgroundColor: '#0f0f1f',
                borderRadius: '6px',
                border: '2px solid #9933ff'
              }}>
                <div style={{ fontWeight: 'bold', color: '#9933ff', marginBottom: '5px' }}>
                  {trend.pid}: {trend.trend.toUpperCase()}
                </div>
                <div style={{ color: '#fff', fontSize: '0.95rem' }}>
                  {trend.prediction}
                </div>
                {trend.anomalies > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#ff6600' }}>
                    ⚠️ {trend.anomalies} anomalous readings detected
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {diagnostics.length > 0 && (
          <div style={{
            padding: '30px',
            backgroundColor: '#0f3460',
            borderRadius: '10px',
            border: '3px solid #00d4ff',
            marginBottom: '20px'
          }}>
            <h3 style={{ color: '#00d4ff', fontSize: '1.8rem', marginBottom: '20px' }}>
              🔍 Diagnostic Findings
            </h3>
            {diagnostics.map((finding, i) => (
              <div key={i} style={{
                padding: '15px',
                marginBottom: '10px',
                backgroundColor: finding.includes('🔴') ? '#3d0f0f' : finding.includes('🟡') ? '#3d2e0f' : '#0f1f3d',
                borderRadius: '8px',
                borderLeft: `5px solid ${finding.includes('🔴') ? '#ff3333' : finding.includes('🟡') ? '#ffaa00' : '#33aaff'}`,
                fontSize: '1.1rem'
              }}>
                {finding}
              </div>
            ))}
          </div>
        )}

        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: '#0f3460',
          borderRadius: '10px',
          fontSize: '0.9rem',
          color: '#bbb'
        }}>
          <h4 style={{ color: '#00d4ff', marginBottom: '10px' }}>✅ Advanced Features:</h4>
          <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
            <li><strong>File Formats:</strong> CSV, TXT, ZIP, BRC (Car Scanner)</li>
            <li><strong>19+ Diagnostic Systems:</strong> Coolant, battery/charging, fuel trims, MAF, O2 sensors, TPS, IAT, ignition timing, misfire detection, engine load analysis, catalyst efficiency, transmission, torque converter, fuel efficiency, boost pressure, knock detection, sensor correlation, DPF/emissions</li>
            <li><strong>🔮 Predictive Analysis:</strong> 10+ known fault patterns with failure prediction and time-to-failure estimates (head gasket, turbo, transmission, fuel pump, catalytic converter, timing chain, coil degradation)</li>
            <li><strong>📈 Trend Analysis:</strong> Automatic detection of increasing/decreasing/erratic patterns across all parameters with anomaly detection</li>
            <li><strong>🔗 Multi-Parameter Correlation:</strong> Cross-references multiple sensors to identify root causes (coolant+fuel trim, MAF+load, O2 bank comparison, trans temp+slip)</li>
            <li><strong>⚠️ Smart Fault Detection:</strong> Professional-grade AI-like pattern matching identifies complex mechanical issues before catastrophic failure</li>
            <li><strong>Performance:</strong> Fast processing (2000 rows/file), persistent history, no stack overflow</li>
            <li><strong>Storage:</strong> Auto-save last 50 diagnostic sessions with full predictions to localStorage</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
