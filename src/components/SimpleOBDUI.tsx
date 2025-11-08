import React, { useState } from "react";
import JSZip from "jszip";
import Papa from "papaparse";
import {
  runComprehensiveDiagnostics,
  type Finding,
  type LongRow,
  type TripSummary,
} from "@/lib/diagnostics";
import { canonPid } from "@/lib/pidMapper";
import { median, avg, max, min } from "@/lib/statistics";

type LongRowInternal = {
  timeRaw: number | string | Date;
  pid: string;
  value: number | null;
  units: string | null;
  file: string;
};

export default function SimpleOBDUI() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [summaries, setSummaries] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileCount, setFileCount] = useState(0);

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

  const parseCSVString = async (text: string, fileLabel: string): Promise<LongRowInternal[]> => {
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });
    if (!parsed || !parsed.meta || !parsed.meta.fields) return [];

    const cols = parsed.meta.fields;
    const rows = parsed.data as any[];
    const timeCol = cols.find((c) => ["time", "timestamp", "seconds", "SECONDS"].includes(c)) || cols[0];

    const lon: LongRowInternal[] = [];
    for (const r of rows) {
      const t = parseTimeValue(r[timeCol]);
      for (const c of cols) {
        if (c === timeCol) continue;
        const pid = canonPid(c);
        const val = toNumber(r[c]);
        lon.push({ timeRaw: t ?? 0, pid, value: val, units: null, file: fileLabel });
      }
    }
    return lon;
  };

  const parseFile = async (file: File): Promise<LongRowInternal[]> => {
    const name = file.name.toLowerCase();
    if (name.endsWith(".zip")) {
      const zip = await JSZip.loadAsync(file);
      const rows: LongRowInternal[] = [];
      for (const key of Object.keys(zip.files)) {
        const entry = zip.files[key];
        if (entry.dir) continue;
        if (!key.toLowerCase().match(/\\.(csv|txt)$/)) continue;
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

  const perTripSummaries = (longRows: LongRowInternal[]) => {
    const byTrip: Record<string, LongRowInternal[]> = {};
    for (const r of longRows) {
      const id = (r.file || "trip").replace(/\\.csv$/i, "");
      if (!byTrip[id]) byTrip[id] = [];
      byTrip[id].push(r);
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

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setLoading(true);
    setFileCount(files.length);

    try {
      const all: LongRowInternal[] = [];
      for (const f of Array.from(files)) {
        const parsed = await parseFile(f);
        all.push(...parsed);
      }

      const { summaries, byTrip } = perTripSummaries(all);
      setSummaries(summaries);

      const diagnosticResults = runComprehensiveDiagnostics(summaries, byTrip);
      setFindings(diagnosticResults);
    } catch (error) {
      console.error("Error processing files:", error);
      alert("Error processing files. See console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px',
        background: 'white',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <h1 style={{
          fontSize: '3rem',
          fontWeight: 'bold',
          background: 'linear-gradient(to right, #667eea, #764ba2)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '10px'
        }}>
          🚗 OBD Diagnostic Analyzer Pro
        </h1>

        <p style={{
          fontSize: '1.2rem',
          color: '#666',
          marginBottom: '40px'
        }}>
          Professional-grade automotive diagnostics • 34 detection systems • Free & Private
        </p>

        <div style={{
          border: '4px dashed #667eea',
          borderRadius: '16px',
          padding: '60px 40px',
          textAlign: 'center',
          background: '#f8f9ff',
          marginBottom: '30px',
          cursor: 'pointer',
          transition: 'all 0.3s'
        }}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = '#764ba2'; }}
        onDragLeave={(e) => { e.currentTarget.style.borderColor = '#667eea'; }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.style.borderColor = '#667eea';
          handleFiles(e.dataTransfer.files);
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📁</div>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '15px', color: '#333' }}>
            Drop CSV/ZIP files here or click to upload
          </h2>
          <p style={{ fontSize: '1.1rem', color: '#666', marginBottom: '20px' }}>
            Supports Car Scanner, Torque, OBD Fusion exports
          </p>
          <input
            type="file"
            multiple
            accept=".csv,.zip,.txt"
            onChange={(e) => handleFiles(e.target.files)}
            style={{
              padding: '15px 40px',
              fontSize: '1.2rem',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '50px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          />
        </div>

        {loading && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            fontSize: '1.5rem',
            color: '#667eea'
          }}>
            ⏳ Processing {fileCount} file(s)...
          </div>
        )}

        {summaries.length > 0 && (
          <>
            <div style={{
              background: '#f0f4ff',
              padding: '30px',
              borderRadius: '12px',
              marginBottom: '30px'
            }}>
              <h2 style={{ fontSize: '2rem', marginBottom: '20px', color: '#333' }}>
                📊 Trip Summaries ({summaries.length})
              </h2>
              {summaries.map((s) => (
                <div key={s.tripId} style={{
                  background: 'white',
                  padding: '20px',
                  borderRadius: '8px',
                  marginBottom: '15px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}>
                  <h3 style={{ fontSize: '1.3rem', marginBottom: '10px', color: '#667eea' }}>
                    {s.tripId}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '0.95rem' }}>
                    <div>🏎️ Max Speed: {s.speedMaxKmh?.toFixed(0) ?? '-'} km/h</div>
                    <div>🌡️ Coolant: {s.coolantMaxC?.toFixed(1) ?? '-'}°C</div>
                    <div>🔋 Voltage: {s.vbatMin?.toFixed(1) ?? '-'} - {s.vbatMax?.toFixed(1) ?? '-'} V</div>
                    <div>⚙️ Max RPM: {s.rpmMax?.toFixed(0) ?? '-'}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              background: '#fff8f0',
              padding: '30px',
              borderRadius: '12px'
            }}>
              <h2 style={{ fontSize: '2rem', marginBottom: '20px', color: '#333' }}>
                🔍 Diagnostic Findings ({findings.length})
              </h2>
              {findings.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  fontSize: '1.3rem',
                  color: '#22c55e'
                }}>
                  ✅ No issues detected! Your vehicle appears healthy.
                </div>
              )}
              {findings.map((f, i) => (
                <div key={i} style={{
                  background: f.level === 'fail' ? '#fee2e2' : f.level === 'warn' ? '#fef3c7' : '#dbeafe',
                  border: `3px solid ${f.level === 'fail' ? '#ef4444' : f.level === 'warn' ? '#f59e0b' : '#3b82f6'}`,
                  padding: '20px',
                  borderRadius: '8px',
                  marginBottom: '15px'
                }}>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <span style={{
                      background: f.level === 'fail' ? '#ef4444' : f.level === 'warn' ? '#f59e0b' : '#3b82f6',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold'
                    }}>
                      {f.level.toUpperCase()}
                    </span>
                    <span style={{
                      background: 'white',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '0.8rem'
                    }}>
                      {f.category}
                    </span>
                    {f.tripId && (
                      <span style={{
                        background: 'white',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '0.8rem',
                        fontFamily: 'monospace'
                      }}>
                        {f.tripId}
                      </span>
                    )}
                  </div>
                  <p style={{
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    marginBottom: '8px',
                    color: '#1f2937'
                  }}>
                    {f.message}
                  </p>
                  {f.detail && (
                    <p style={{
                      fontSize: '0.95rem',
                      color: '#4b5563',
                      borderLeft: '3px solid #9ca3af',
                      paddingLeft: '15px',
                      marginTop: '10px'
                    }}>
                      {f.detail}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{
          marginTop: '40px',
          padding: '20px',
          background: '#f9fafb',
          borderRadius: '8px',
          fontSize: '0.9rem',
          color: '#6b7280'
        }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '10px', color: '#374151' }}>
            💡 How to Use:
          </h3>
          <ol style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
            <li>Export OBD data from your scanner app (Car Scanner, Torque, etc.) as CSV or ZIP</li>
            <li>Upload the files using the area above</li>
            <li>View comprehensive diagnostics powered by 34 detection systems</li>
            <li>All processing happens in your browser - your data never leaves your device</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
