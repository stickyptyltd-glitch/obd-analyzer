import React, { useState, useRef } from "react";
import JSZip from "jszip";
import Papa from "papaparse";
import "./animations.css";
import {
  runComprehensiveDiagnostics,
  type Finding,
  type LongRow,
  type TripSummary,
} from "@/lib/diagnostics";
import { canonPid } from "@/lib/pidMapper";
import { avg, max, min } from "@/lib/statistics";

export default function UltraSimple() {
  const [message, setMessage] = useState("No files uploaded yet");
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [summaries, setSummaries] = useState<TripSummary[]>([]);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const toNumber = (n: any): number | null => {
    if (n == null || n === "") return null;
    const f = Number(String(n).replace(/,/g, ""));
    return Number.isFinite(f) ? f : null;
  };

  const parseTimeValue = (v: any): number | Date | null => {
    if (v == null || v === "") return null;
    const f = Number(v);
    if (!Number.isNaN(f) && Number.isFinite(f)) return f;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
    return null;
  };

  const parseCSVString = async (text: string, fileLabel: string): Promise<LongRow[]> => {
    console.log(`Parsing CSV: ${fileLabel}, size: ${text.length} chars`);

    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
    if (!parsed || !parsed.meta || !parsed.meta.fields) {
      console.log("No data in CSV");
      return [];
    }

    const cols = parsed.meta.fields;
    const rows = parsed.data as any[];
    console.log(`CSV has ${cols.length} columns, ${rows.length} rows`);

    // Limit rows to prevent memory issues
    const maxRows = Math.min(rows.length, 5000);
    if (rows.length > maxRows) {
      console.log(`Limiting to first ${maxRows} rows`);
    }

    const timeCol = cols.find((c) => ["time", "timestamp", "seconds", "SECONDS"].includes(c)) || cols[0];

    const lon: LongRow[] = [];
    for (let i = 0; i < maxRows; i++) {
      const r = rows[i];
      if (!r) continue;

      const t = parseTimeValue(r[timeCol]);
      for (const c of cols) {
        if (c === timeCol) continue;
        const pid = canonPid(c);
        const val = toNumber(r[c]);
        lon.push({ timeRaw: t ?? 0, pid, value: val, units: null, file: fileLabel });
      }

      // Update progress for large files
      if (i % 1000 === 0 && i > 0) {
        console.log(`Processed ${i}/${maxRows} rows`);
        await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI to update
      }
    }

    console.log(`Parsed ${lon.length} data points from ${fileLabel}`);
    return lon;
  };

  const parseFile = async (file: File): Promise<LongRow[]> => {
    const name = file.name.toLowerCase();
    if (name.endsWith(".zip")) {
      const zip = await JSZip.loadAsync(file);
      const rows: LongRow[] = [];
      for (const key of Object.keys(zip.files)) {
        const entry = zip.files[key];
        if (entry.dir) continue;
        if (!key.toLowerCase().match(/\.(csv|txt)$/)) continue;
        const content = await entry.async("string");
        rows.push(...(await parseCSVString(content, key)));
      }
      return rows;
    }
    if (name.endsWith(".csv") || name.endsWith(".txt")) {
      const text = await file.text();
      return parseCSVString(text, file.name);
    }
    return [];
  };

  const perTripSummaries = (longRows: LongRow[]) => {
    const byTrip: Record<string, LongRow[]> = {};

    // Safety limit
    const rowLimit = Math.min(longRows.length, 50000);

    for (let i = 0; i < rowLimit; i++) {
      const r = longRows[i];
      if (!r) continue;
      const id = (r.file || "trip").replace(/\.csv$/i, "");
      if (!byTrip[id]) byTrip[id] = [];

      // Limit rows per trip
      if (byTrip[id].length < 10000) {
        byTrip[id].push(r);
      }
    }

    const summaries: TripSummary[] = [];
    for (const [tripId, rows] of Object.entries(byTrip)) {
      const valuesOf = (pid: string) =>
        rows.filter((r) => r.pid === pid && r.value != null).map((r) => r.value!);

      const sp = valuesOf("Vehicle speed");
      const rpm = valuesOf("Engine RPM");
      const ect = valuesOf("Engine coolant temperature");
      const vbat = valuesOf("Control module voltage");
      const stft = valuesOf("STFT");
      const ltft = valuesOf("LTFT");

      summaries.push({
        tripId,
        durationMin: null,
        speedAvgKmh: avg(sp),
        speedMaxKmh: max(sp),
        coolantMinC: min(ect),
        coolantMaxC: max(ect),
        warmupTo80CMin: null,
        rpmMax: max(rpm),
        mafIdleGs: null,
        mafLoadGs: null,
        vbatMin: min(vbat),
        vbatMax: max(vbat),
        stftAvgPct: avg(stft),
        ltftAvgPct: avg(ltft),
      });
    }
    return { summaries, byTrip };
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      setMessage("No files selected");
      return;
    }

    const names = Array.from(files).map(f => f.name);
    setFileNames(names);
    setProcessing(true);
    setFindings([]);
    setSummaries([]);

    try {
      // Step 1: Parse files
      setMessage(`📂 Step 1/3: Reading ${files.length} file(s)...`);
      console.log("Starting file parsing...");

      const all: LongRow[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setMessage(`📂 Step 1/3: Reading file ${i + 1}/${files.length}: ${f.name} (${(f.size / 1024).toFixed(0)} KB)`);
        console.log(`Parsing file ${i + 1}/${files.length}: ${f.name}, size: ${f.size} bytes`);

        // Skip files that are too large
        if (f.size > 10 * 1024 * 1024) { // 10MB limit
          console.warn(`Skipping ${f.name} - too large (${(f.size / 1024 / 1024).toFixed(1)} MB)`);
          setMessage(`⚠️ Skipping ${f.name} - file too large (max 10MB)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        try {
          const parsed = await parseFile(f);
          all.push(...parsed);
          console.log(`Parsed ${parsed.length} data points from ${f.name}`);
        } catch (parseError) {
          console.error(`Error parsing ${f.name}:`, parseError);
          setMessage(`⚠️ Error reading ${f.name}, skipping...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`Total rows parsed: ${all.length}`);

      // Limit data size to prevent stack overflow
      if (all.length > 50000) {
        setMessage(`⚠️ Warning: File too large (${all.length} rows). Using first 50,000 rows only.`);
        all.splice(50000);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Show warning for 2s
      }

      // Step 2: Generate summaries
      setMessage(`📊 Step 2/3: Generating trip summaries...`);
      console.log("Generating trip summaries...");
      const { summaries, byTrip } = perTripSummaries(all);
      setSummaries(summaries);
      console.log(`Generated ${summaries.length} trip summaries`);

      // Step 3: Run diagnostics
      setMessage(`🔍 Step 3/3: Running 12 diagnostic systems...`);
      console.log("Running comprehensive diagnostics...");
      console.log("Summaries:", summaries.length, "trips");
      console.log("Data keys:", Object.keys(byTrip));

      let diagnosticResults: Finding[] = [];
      try {
        diagnosticResults = runComprehensiveDiagnostics(summaries, byTrip);
        console.log(`Analysis complete: ${diagnosticResults.length} findings`);
      } catch (diagError) {
        console.error("Error in diagnostics:", diagError);
        throw new Error(`Diagnostics failed: ${diagError instanceof Error ? diagError.message : String(diagError)}`);
      }

      setFindings(diagnosticResults);

      setMessage(`✅ Analysis Complete! Found ${diagnosticResults.length} diagnostic findings across ${summaries.length} trip(s).`);

      // Auto-scroll to results after a short delay
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
    } catch (error) {
      console.error("❌ Error processing files:", error);
      setMessage(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      margin: 0,
      padding: 0,
      backgroundColor: '#1a1a2e',
      color: '#fff',
      fontFamily: 'Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center'
    }}>
      <div style={{
        width: '90%',
        maxWidth: '800px',
        padding: '40px',
        backgroundColor: '#16213e',
        borderRadius: '20px',
        boxShadow: '0 10px 50px rgba(0,0,0,0.5)'
      }}>
        <h1 style={{
          fontSize: '3rem',
          marginBottom: '20px',
          color: '#00d4ff'
        }}>
          🚗 OBD ANALYZER
        </h1>

        <p style={{
          fontSize: '1.5rem',
          marginBottom: '40px',
          color: '#aaa'
        }}>
          Upload your OBD CSV/ZIP files
        </p>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv,.zip,.txt"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* HUGE VISIBLE BUTTON */}
        <button
          onClick={handleButtonClick}
          style={{
            width: '100%',
            padding: '40px',
            fontSize: '2rem',
            fontWeight: 'bold',
            backgroundColor: '#0f4c75',
            color: '#fff',
            border: '4px solid #00d4ff',
            borderRadius: '15px',
            cursor: 'pointer',
            marginBottom: '30px',
            transition: 'all 0.3s',
            boxShadow: '0 5px 20px rgba(0,212,255,0.4)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#00d4ff';
            e.currentTarget.style.color = '#000';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#0f4c75';
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          📁 CLICK HERE TO SELECT FILES
        </button>

        {/* Status Message */}
        <div style={{
          padding: '30px',
          backgroundColor: message.includes('✅') ? '#0f3d1f' : '#0f3460',
          borderRadius: '10px',
          fontSize: '1.3rem',
          marginBottom: '20px',
          border: message.includes('✅') ? '3px solid #00ff66' : '2px solid #00d4ff',
          color: message.includes('✅') ? '#00ff66' : '#fff'
        }}>
          {processing && <div style={{ marginBottom: '15px', fontSize: '2rem' }}>⏳</div>}
          {message}
          {message.includes('✅') && (
            <div style={{
              marginTop: '20px',
              fontSize: '1.8rem',
              fontWeight: 'bold',
              animation: 'bounce 1s infinite'
            }}>
              👇 SCROLL DOWN TO SEE RESULTS 👇
            </div>
          )}
        </div>

        {/* File List */}
        {fileNames.length > 0 && (
          <div style={{
            padding: '20px',
            backgroundColor: '#1a1a2e',
            borderRadius: '10px',
            textAlign: 'left'
          }}>
            <h3 style={{ color: '#00d4ff', marginBottom: '15px' }}>Selected Files:</h3>
            {fileNames.map((name, i) => (
              <div key={i} style={{
                padding: '10px',
                marginBottom: '5px',
                backgroundColor: '#16213e',
                borderRadius: '5px',
                borderLeft: '4px solid #00d4ff'
              }}>
                {i + 1}. {name}
              </div>
            ))}
          </div>
        )}

        {/* SCROLL TARGET FOR RESULTS */}
        <div ref={resultsRef} />

        {/* BIG RESULTS HEADER */}
        {summaries.length > 0 && (
          <div style={{
            marginTop: '50px',
            padding: '30px',
            backgroundColor: '#00d4ff',
            color: '#000',
            borderRadius: '15px',
            textAlign: 'center',
            fontSize: '2.5rem',
            fontWeight: 'bold',
            boxShadow: '0 10px 30px rgba(0,212,255,0.6)',
            animation: 'pulse 2s infinite'
          }}>
            🎉 RESULTS READY! SCROLL DOWN 👇
          </div>
        )}

        {/* TRIP SUMMARIES */}
        {summaries.length > 0 && (
          <div style={{
            marginTop: '30px',
            padding: '25px',
            backgroundColor: '#0f3460',
            borderRadius: '10px',
            textAlign: 'left',
            border: '2px solid #00d4ff'
          }}>
            <h3 style={{ color: '#00d4ff', fontSize: '1.8rem', marginBottom: '20px' }}>
              📊 Trip Summaries ({summaries.length})
            </h3>
            {summaries.map((s, i) => (
              <div key={i} style={{
                padding: '20px',
                marginBottom: '15px',
                backgroundColor: '#1a1a2e',
                borderRadius: '8px',
                borderLeft: '5px solid #00d4ff'
              }}>
                <h4 style={{ color: '#00d4ff', fontSize: '1.3rem', marginBottom: '15px' }}>{s.tripId}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '1.1rem' }}>
                  <div>🏎️ Speed: {s.speedMaxKmh?.toFixed(0) ?? '-'} km/h</div>
                  <div>🌡️ Coolant: {s.coolantMaxC?.toFixed(1) ?? '-'}°C</div>
                  <div>⚡ RPM: {s.rpmMax?.toFixed(0) ?? '-'}</div>
                  <div>🔋 Voltage: {s.vbatMin?.toFixed(1) ?? '-'}-{s.vbatMax?.toFixed(1) ?? '-'}V</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* DIAGNOSTIC FINDINGS */}
        {findings.length > 0 && (
          <div style={{
            marginTop: '30px',
            padding: '25px',
            backgroundColor: '#0f3460',
            borderRadius: '10px',
            textAlign: 'left',
            border: '2px solid #ff3333'
          }}>
            <h3 style={{ color: '#ff3333', fontSize: '1.8rem', marginBottom: '20px' }}>
              🔍 Diagnostic Findings ({findings.length})
            </h3>
            {findings.map((f, i) => (
              <div key={i} style={{
                padding: '20px',
                marginBottom: '15px',
                backgroundColor: f.level === 'fail' ? '#3d0f0f' : f.level === 'warn' ? '#3d2e0f' : '#0f1f3d',
                borderRadius: '8px',
                borderLeft: `5px solid ${f.level === 'fail' ? '#ff3333' : f.level === 'warn' ? '#ffaa00' : '#33aaff'}`
              }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '5px 15px',
                    borderRadius: '20px',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    backgroundColor: f.level === 'fail' ? '#ff3333' : f.level === 'warn' ? '#ffaa00' : '#33aaff',
                    color: '#000'
                  }}>
                    {f.level.toUpperCase()}
                  </span>
                  <span style={{
                    padding: '5px 15px',
                    borderRadius: '20px',
                    fontSize: '0.9rem',
                    backgroundColor: '#1a1a2e',
                    border: '1px solid #00d4ff'
                  }}>
                    {f.category}
                  </span>
                  {f.tripId && (
                    <span style={{
                      padding: '5px 15px',
                      borderRadius: '20px',
                      fontSize: '0.9rem',
                      backgroundColor: '#1a1a2e',
                      fontFamily: 'monospace'
                    }}>
                      {f.tripId}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '10px', color: '#fff' }}>
                  {f.message}
                </p>
                {f.detail && (
                  <p style={{
                    fontSize: '1rem',
                    color: '#bbb',
                    paddingLeft: '15px',
                    borderLeft: '3px solid #555',
                    marginTop: '10px'
                  }}>
                    💡 {f.detail}
                  </p>
                )}
                {f.pid && (
                  <p style={{ fontSize: '0.9rem', color: '#888', marginTop: '10px', fontFamily: 'monospace' }}>
                    PID: {f.pid}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {findings.length === 0 && summaries.length > 0 && (
          <div style={{
            marginTop: '30px',
            padding: '40px',
            backgroundColor: '#0f3d1f',
            borderRadius: '10px',
            textAlign: 'center',
            border: '2px solid #00ff66',
            fontSize: '1.5rem',
            color: '#00ff66'
          }}>
            ✅ No Issues Detected! Your vehicle appears healthy.
          </div>
        )}

        {/* Instructions */}
        {summaries.length === 0 && (
          <div style={{
            marginTop: '40px',
            padding: '20px',
            backgroundColor: '#0f3460',
            borderRadius: '10px',
            fontSize: '1rem',
            color: '#bbb',
            textAlign: 'left'
          }}>
            <h4 style={{ color: '#00d4ff', marginBottom: '10px' }}>📋 Instructions:</h4>
            <ol style={{ paddingLeft: '25px', lineHeight: '2' }}>
              <li>Click the BIG BLUE BUTTON above</li>
              <li>Select CSV or ZIP files from Car Scanner/Torque/OBD Fusion</li>
              <li>Wait for 12 diagnostic systems to analyze your data</li>
              <li>View detailed findings and trip summaries below</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
