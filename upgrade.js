const fs = require('fs');

const code = `import React, { useMemo, useState } from "react";
import { Upload, FileSpreadsheet, Gauge, Battery, Thermometer, Wind, AlertTriangle, CheckCircle2, Download, Settings2, Activity, Zap, Filter } from "lucide-react";
import JSZip from "jszip";
import Papa from "papaparse";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { canonPid, getPidCategory } from "@/lib/pidMapper";
import { runComprehensiveDiagnostics, type Finding, type LongRow, type TripSummary } from "@/lib/diagnostics";
import { median, avg, max, min } from "@/lib/statistics";

const unitHeaderRegex = /^(.+?)\\s*\\(([^)]+)\\)\\s*$|^(.+)$/;

function parseTimeValue(v: any): number | Date | null {
  if (v == null || v === "") return null;
  const f = Number(v);
  if (!Number.isNaN(f) && Number.isFinite(f)) return f;
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return d;
  return null;
}

function headerToNameUnits(h: string): { name: string; units: string | null } {
  const m = (h || "").toString().match(unitHeaderRegex);
  if (!m) return { name: h, units: null };
  if (m[2]) return { name: m[1].trim(), units: m[2].trim() };
  return { name: m[3].trim(), units: null };
}

function toNumber(n: any): number | null {
  if (n == null || n === "") return null;
  const f = Number(String(n).replace(/,/g, ""));
  return Number.isFinite(f) ? f : null;
}

function minutesFrom(timeRaw: number | Date | null, t0: number | Date | null): number | null {
  if (timeRaw == null || t0 == null) return null;
  if (typeof timeRaw === "number" && typeof t0 === "number") return (timeRaw - t0) / 60;
  if (timeRaw instanceof Date && t0 instanceof Date) return (timeRaw.getTime() - t0.getTime()) / 60000;
  if (typeof timeRaw === "number" && t0 instanceof Date) return (timeRaw - t0.getTime() / 1000) / 60;
  if (timeRaw instanceof Date && typeof t0 === "number") return (timeRaw.getTime() / 1000 - t0) / 60;
  return null;
}

function exportCSV(filename: string, rows: any[]) {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function parseFile(file: File): Promise<LongRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(file);
    const rows: LongRow[] = [];
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
}

async function parseCSVString(text: string, fileLabel: string): Promise<LongRow[]> {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
  if (!parsed || !parsed.meta || !parsed.meta.fields) return [];
  const cols = parsed.meta.fields;
  const rows = parsed.data as any[];
  const hasLong = cols.some((c) => c.trim().toLowerCase() === "pid") && cols.some((c) => c.trim().toLowerCase() === "value");
  const timeCol = cols.find((c) => ["time", "timestamp", "seconds", "SECONDS"].includes(c)) || cols[0];
  if (hasLong) {
    return rows.map((r) => {
      const t = parseTimeValue(r[timeCol]);
      const pid = canonPid(String(r["PID"]));
      const val = toNumber(r["VALUE"])!;
      const units = (r["UNITS"] ?? null) as string | null;
      return { timeRaw: t ?? 0, pid, value: val, units, file: fileLabel };
    });
  }
  const lon: LongRow[] = [];
  for (const r of rows) {
    const t = parseTimeValue(r[timeCol]);
    for (const c of cols) {
      if (c === timeCol) continue;
      const { name, units } = headerToNameUnits(c);
      const pid = canonPid(name);
      const val = toNumber(r[c]);
      lon.push({ timeRaw: t ?? 0, pid, value: val, units, file: fileLabel });
    }
  }
  return lon;
}

function nearestValue(series: { t: any; v: number }[], t: any): number | null {
  if (!series.length) return null;
  const toMs = (x: any) => (x instanceof Date ? x.getTime() : typeof x === "number" ? x * 1000 : Number(new Date(x)));
  const tt = toMs(t);
  let best: number | null = null;
  let bestDist = Infinity;
  for (const s of series) {
    const d = Math.abs(toMs(s.t) - tt);
    if (d < bestDist) {
      bestDist = d;
      best = s.v;
    }
  }
  return best;
}

function perTripSummaries(longRows: LongRow[]): { summaries: TripSummary[]; byTrip: Record<string, LongRow[]> } {
  const byTrip: Record<string, LongRow[]> = {};
  for (const r of longRows) {
    const id = (r.file || "trip").replace(/\\.csv$/i, "");
    if (!byTrip[id]) byTrip[id] = [];
    byTrip[id].push(r);
  }
  const summaries: TripSummary[] = [];
  for (const [tripId, rows] of Object.entries(byTrip)) {
    const times = rows.map((r) => r.timeRaw).filter((x) => x != null);
    let t0: number | Date | null = null;
    if (times.length) {
      const numTimes = times.filter((t) => typeof t === "number") as number[];
      const dateTimes = times.filter((t) => t instanceof Date) as Date[];
      if (dateTimes.length) t0 = new Date(Math.min(...dateTimes.map((d) => d.getTime())));
      else if (numTimes.length) t0 = Math.min(...numTimes);
    }
    const valuesOf = (pid: string) => rows.filter((r) => r.pid === pid && r.value != null).map((r) => r.value!);
    const sp = valuesOf("Vehicle speed");
    const gps = valuesOf("Speed (GPS)");
    const speedAvg = sp.length ? avg(sp) : avg(gps);
    const speedMax = sp.length ? max(sp) : max(gps);
    const ect = valuesOf("Engine coolant temperature");
    const coolantMin = min(ect);
    const coolantMax = max(ect);
    let warmupMin: number | null = null;
    if (ect.length) {
      const series = rows.filter((r) => r.pid === "Engine coolant temperature" && r.value != null);
      if (series.length && t0 != null) {
        const idx = series.findIndex((s) => (s.value ?? 0) >= 80);
        if (idx >= 0) {
          const tFirst = minutesFrom(series[0].timeRaw as any, t0);
          const tReach = minutesFrom(series[idx].timeRaw as any, t0);
          if (tFirst != null && tReach != null) warmupMin = tReach - tFirst;
        }
      }
    }
    const rpm = valuesOf("Engine RPM");
    const mafRows = rows.filter((r) => r.pid === "MAF air flow rate");
    const mafGs = mafRows.map((r) => {
      if (r.value == null) return null;
      const u = (r.units || "").toLowerCase();
      if (u.includes("kg/hour")) return (r.value * 1000) / 3600;
      return r.value;
    }).filter((x) => x != null) as number[];
    const mergeSeries = (name: string) => rows.filter((r) => r.pid === name && r.value != null).map((r) => ({ t: r.timeRaw, v: r.value! }));
    const speedSeries = mergeSeries("Vehicle speed");
    const rpmSeries = mergeSeries("Engine RPM");
    const mafSeries = rows.filter((r) => r.pid === "MAF air flow rate" && r.value != null).map((r) => ({
      t: r.timeRaw,
      v: (r.units || "").toLowerCase().includes("kg/hour") ? (r.value! * 1000) / 3600 : r.value!,
    }));
    const idleCandidates: number[] = [];
    const loadCandidates: number[] = [];
    for (const m of mafSeries) {
      const t = m.t;
      const spNear = nearestValue(speedSeries, t);
      const rpmNear = nearestValue(rpmSeries, t);
      if (spNear == null || rpmNear == null) continue;
      if (spNear >= 0 && spNear < 5 && rpmNear >= 550 && rpmNear <= 950) idleCandidates.push(m.v);
      if (spNear > 40 && rpmNear > 2000) loadCandidates.push(m.v);
    }
    const mafIdleGs = median(idleCandidates);
    const mafLoadGs = median(loadCandidates);
    const vbat = valuesOf("Control module voltage");
    const stft = valuesOf("STFT");
    const ltft = valuesOf("LTFT");
    const summary: TripSummary = {
      tripId,
      durationMin: durationFromRows(rows, t0),
      speedAvgKmh: speedAvg,
      speedMaxKmh: speedMax,
      coolantMinC: coolantMin,
      coolantMaxC: coolantMax,
      warmupTo80CMin: warmupMin,
      rpmMax: max(rpm),
      mafIdleGs: mafIdleGs ?? null,
      mafLoadGs: mafLoadGs ?? null,
      vbatMin: min(vbat),
      vbatMax: max(vbat),
      stftAvgPct: avg(stft),
      ltftAvgPct: avg(ltft),
    };
    summaries.push(summary);
  }
  return { summaries, byTrip };
}

function durationFromRows(rows: LongRow[], t0: number | Date | null): number | null {
  const times = rows.map((r) => r.timeRaw).filter((x) => x != null);
  if (!times.length) return null;
  const nums = times.filter((t) => typeof t === "number") as number[];
  const dates = times.filter((t) => t instanceof Date) as Date[];
  if (dates.length) {
    const minT = Math.min(...dates.map((d) => d.getTime()));
    const maxT = Math.max(...dates.map((d) => d.getTime()));
    return (maxT - minT) / 60000;
  }
  if (nums.length) {
    return (Math.max(...nums) - Math.min(...nums)) / 60;
  }
  return null;
}

export default function OBDAnalyzerApp() {
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<LongRow[]>([]);
  const [summaries, setSummaries] = useState<TripSummary[]>([]);
  const [byTrip, setByTrip] = useState<Record<string, LongRow[]>>({});
  const [findings, setFindings] = useState<Finding[]>([]);
  const [busy, setBusy] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("All");

  async function handleFiles(selected: FileList | null) {
    if (!selected || !selected.length) return;
    setBusy(true);
    try {
      const list = Array.from(selected);
      setFiles(list);
      const all: LongRow[] = [];
      for (const f of list) {
        const parsed = await parseFile(f);
        all.push(...parsed);
      }
      const cleaned = all.map((r) => ({ ...r, pid: canonPid(r.pid), units: r.units || null }));
      setRows(cleaned);
      const { summaries, byTrip } = perTripSummaries(cleaned);
      setSummaries(summaries);
      setByTrip(byTrip);
      
      // Run comprehensive diagnostics
      const diagnosticResults = runComprehensiveDiagnostics(summaries, byTrip);
      setFindings(diagnosticResults);
    } finally {
      setBusy(false);
    }
  }

  const hasData = summaries.length > 0;
  
  const categories = useMemo(() => {
    const cats = new Set(findings.map(f => f.category));
    return ["All", ...Array.from(cats).sort()];
  }, [findings]);
  
  const filteredFindings = useMemo(() => {
    return filterCategory === "All" ? findings : findings.filter(f => f.category === filterCategory);
  }, [findings, filterCategory]);
  
  const findingsByLevel = useMemo(() => {
    return {
      fail: filteredFindings.filter(f => f.level === "fail").length,
      warn: filteredFindings.filter(f => f.level === "warn").length,
      info: filteredFindings.filter(f => f.level === "info").length,
    };
  }, [filteredFindings]);

  return (
    <div className="min-h-screen p-6 md:p-10 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              OBD Diagnostic Analyzer Pro
            </h1>
            <p className="text-gray-600">Comprehensive automotive diagnostics powered by advanced analytics</p>
          </div>
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" onClick={() => exportCSV("trip_summaries.csv", summaries)} disabled={!hasData}>
                    <Download className="w-4 h-4 mr-2" />Summary
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download trip metrics</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" onClick={() => exportCSV("diagnostic_findings.csv", findings)} disabled={!hasData}>
                    <Download className="w-4 h-4 mr-2" />Findings
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download diagnostic report</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </header>

        <Card className="shadow-lg border-2 border-blue-100">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div className="border-2 border-dashed border-blue-300 rounded-2xl p-8 text-center bg-gradient-to-br from-white to-blue-50 hover:border-blue-400 transition-colors">
                <Upload className="w-12 h-12 mx-auto mb-4 text-blue-600" />
                <p className="font-semibold text-lg mb-2">Drop OBD Data Files</p>
                <p className="text-sm text-gray-600 mb-4">CSV, TXT, or ZIP from Car Scanner, Torque, etc.</p>
                <Input 
                  type="file" 
                  multiple 
                  accept=".csv,.txt,.zip"
                  onChange={(e) => handleFiles(e.target.files)} 
                  className="cursor-pointer"
                />
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  Comprehensive Diagnostics
                </h3>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span><strong>12+ Detection Systems:</strong> Misfires, O2 sensors, catalytic converter, transmission, intake leaks, knock/detonation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span><strong>Advanced Analytics:</strong> Statistical analysis, pattern recognition, correlation detection</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span><strong>Professional Reports:</strong> Severity-ranked findings with detailed explanations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span><strong>100% Private:</strong> All processing happens in your browser</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {busy && (
          <Card className="shadow-lg border-2 border-yellow-200 bg-yellow-50">
            <CardContent className="p-6 text-center">
              <div className="flex items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
                <span className="text-lg font-medium text-yellow-900">Running comprehensive diagnostics...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {hasData && (
          <div className="space-y-6">
            
            {/* Diagnostic Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className={\`shadow-lg border-2 \${findingsByLevel.fail > 0 ? 'border-red-300 bg-red-50' : 'border-gray-200'}\`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Critical Issues</p>
                      <p className="text-3xl font-bold text-red-600">{findingsByLevel.fail}</p>
                    </div>
                    <AlertTriangle className="w-12 h-12 text-red-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>
              <Card className={\`shadow-lg border-2 \${findingsByLevel.warn > 0 ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}\`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Warnings</p>
                      <p className="text-3xl font-bold text-amber-600">{findingsByLevel.warn}</p>
                    </div>
                    <AlertTriangle className="w-12 h-12 text-amber-500 opacity-20" />
                  </div>
                </CardContent>
              </Card>
              <Card className={\`shadow-lg border-2 \${findingsByLevel.fail === 0 && findingsByLevel.warn === 0 ? 'border-green-300 bg-green-50' : 'border-gray-200'}\`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Info / Status</p>
                      <p className="text-3xl font-bold text-blue-600">{findingsByLevel.info}</p>
                    </div>
                    <CheckCircle2 className={\`w-12 h-12 opacity-20 \${findingsByLevel.fail === 0 && findingsByLevel.warn === 0 ? 'text-green-500' : 'text-blue-500'}\`} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <SectionTitle icon={<Settings2 className="w-5 h-5" />} title="Trip Summaries" subtitle="Key metrics per uploaded trip" />
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {summaries.map((s) => (
                <Card key={s.tripId} className="shadow-lg hover:shadow-xl transition-shadow border border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-semibold truncate text-lg" title={s.tripId}>{s.tripId}</div>
                      <Badge variant="secondary" className="font-mono">{s.durationMin?.toFixed(1) ?? "-"} min</Badge>
                    </div>
                    <div className="space-y-2">
                      <MetricRow icon={<Gauge className="w-4 h-4" />} label="Speed" value={\`\${fmtNum(s.speedAvgKmh)} avg / \${fmtNum(s.speedMaxKmh)} max km/h\`} />
                      <MetricRow icon={<Thermometer className="w-4 h-4" />} label="Coolant" value={\`\${fmtNum(s.coolantMaxC)}°C max / warmup \${fmtNum(s.warmupTo80CMin)} min\`} />
                      <MetricRow icon={<Wind className="w-4 h-4" />} label="MAF" value={\`\${fmtNum(s.mafIdleGs)} idle / \${fmtNum(s.mafLoadGs)} load g/s\`} />
                      <MetricRow icon={<Battery className="w-4 h-4" />} label="Voltage" value={\`\${fmtNum(s.vbatMin)}–\${fmtNum(s.vbatMax)} V\`} />
                      <MetricRow icon={<FileSpreadsheet className="w-4 h-4" />} label="Fuel trims" value={\`ST \${fmtNum(s.stftAvgPct)}% / LT \${fmtNum(s.ltftAvgPct)}%\`} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <SectionTitle icon={<AlertTriangle className="w-5 h-5" />} title="Diagnostic Findings" subtitle={\`\${findings.length} potential issues detected\`} />
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select 
                  value={filterCategory} 
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="space-y-3">
              {filteredFindings.length === 0 && (
                <Card className="shadow-lg border-2 border-green-300 bg-green-50">
                  <CardContent className="p-6">
                    <div className="text-center text-green-800 flex flex-col items-center gap-3">
                      <CheckCircle2 className="w-16 h-16 text-green-600" />
                      <div>
                        <p className="text-xl font-semibold mb-2">All Systems Nominal!</p>
                        <p className="text-sm">No significant mechanical issues detected in the analyzed data.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              {filteredFindings.map((f, i) => (<FindingItem key={i} f={f} />))}
            </div>

            <SectionTitle icon={<Gauge className="w-5 h-5" />} title="Data Visualization" subtitle="Interactive charts for trend analysis" />
            <Tabs defaultValue="coolant" className="w-full">
              <TabsList className="mb-3 bg-white shadow-md">
                <TabsTrigger value="coolant">Coolant Temp</TabsTrigger>
                <TabsTrigger value="maf">MAF Rate</TabsTrigger>
                <TabsTrigger value="voltage">Battery</TabsTrigger>
                <TabsTrigger value="trims">Fuel Trims</TabsTrigger>
                <TabsTrigger value="rpm">Engine RPM</TabsTrigger>
                <TabsTrigger value="o2">O2 Sensors</TabsTrigger>
              </TabsList>
              <TabsContent value="coolant">
                <SeriesChart rows={rows} pidName="Engine coolant temperature" yLabel="°C" />
              </TabsContent>
              <TabsContent value="maf">
                <SeriesChart rows={rows} pidName="MAF air flow rate" yLabel="g/s" transform={(v, units) => (units?.toLowerCase().includes("kg/hour") ? (v * 1000) / 3600 : v)} />
              </TabsContent>
              <TabsContent value="voltage">
                <SeriesChart rows={rows} pidName="Control module voltage" yLabel="V" />
              </TabsContent>
              <TabsContent value="trims">
                <SeriesChart rows={rows} pidName="STFT" yLabel="%" />
                <div className="h-4" />
                <SeriesChart rows={rows} pidName="LTFT" yLabel="%" />
              </TabsContent>
              <TabsContent value="rpm">
                <SeriesChart rows={rows} pidName="Engine RPM" yLabel="RPM" />
              </TabsContent>
              <TabsContent value="o2">
                <SeriesChart rows={rows} pidName="O2 Bank 1 Sensor 1" yLabel="V" />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-xl bg-blue-100 shadow-sm">{icon}</div>
      <div>
        <div className="text-lg font-bold text-gray-900">{title}</div>
        {subtitle && <div className="text-sm text-gray-600">{subtitle}</div>}
      </div>
    </div>
  );
}

function MetricRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2 text-gray-700">
        <span className="text-gray-400">{icon}</span>
        {label}
      </div>
      <div className="font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function fmtNum(v: number | null | undefined): string {
  return v == null || Number.isNaN(v) ? "-" : String(Number(v.toFixed(1)));
}

function FindingItem({ f }: { f: Finding }) {
  const levelConfig = {
    fail: { color: "text-red-800", bgColor: "bg-red-50", borderColor: "border-red-300", badge: "destructive" as const },
    warn: { color: "text-amber-800", bgColor: "bg-amber-50", borderColor: "border-amber-300", badge: "secondary" as const },
    info: { color: "text-blue-800", bgColor: "bg-blue-50", borderColor: "border-blue-300", badge: "outline" as const },
  };
  const config = levelConfig[f.level];
  
  return (
    <Card className={\`shadow-md border-2 \${config.borderColor} \${config.bgColor} hover:shadow-lg transition-shadow\`}>
      <CardContent className="p-5">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={config.badge} className="font-semibold">{f.level.toUpperCase()}</Badge>
                <Badge variant="outline" className="text-xs">{f.category}</Badge>
                {f.tripId && <Badge variant="outline" className="text-xs font-mono">{f.tripId}</Badge>}
              </div>
              <p className={\`font-semibold \${config.color} text-base\`}>{f.message}</p>
            </div>
          </div>
          {f.detail && (
            <div className="pl-4 border-l-2 border-gray-300">
              <p className="text-sm text-gray-700 leading-relaxed">{f.detail}</p>
            </div>
          )}
          {f.pid && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Zap className="w-3 h-3" />
              <span className="font-mono">{f.pid}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SeriesChart({ rows, pidName, yLabel, transform }: { rows: LongRow[]; pidName: string; yLabel: string; transform?: (v: number, u?: string | null) => number }) {
  const datasets = useMemo(() => {
    const byTrip: Record<string, { t: number; v: number }[]> = {};
    const byTripT0: Record<string, number> = {};
    for (const r of rows) {
      if (r.pid !== pidName || r.value == null) continue;
      const trip = (r.file || "trip").replace(/\\.csv$/i, "");
      const val = transform ? transform(r.value, r.units ?? undefined) : r.value;
      const tRaw = r.timeRaw;
      let tSec: number | null = null;
      if (typeof tRaw === "number") tSec = tRaw;
      else if (tRaw instanceof Date) tSec = tRaw.getTime() / 1000;
      else {
        const d = new Date(tRaw as any);
        tSec = Number.isNaN(d.getTime()) ? null : d.getTime() / 1000;
      }
      if (tSec == null) continue;
      if (byTripT0[trip] == null) byTripT0[trip] = tSec;
      const tMin = (tSec - byTripT0[trip]) / 60;
      if (!byTrip[trip]) byTrip[trip] = [];
      byTrip[trip].push({ t: tMin, v: val });
    }
    const series = Object.entries(byTrip).map(([trip, arr]) => ({ trip, data: arr.sort((a, b) => a.t - b.t) }));
    return series;
  }, [rows, pidName, transform]);
  
  const chartData = useMemo(() => {
    const merged: { t: number; [series: string]: number | undefined }[] = [];
    const uniqueT = new Set<number>();
    for (const s of datasets) for (const p of s.data) uniqueT.add(Number(p.t.toFixed(3)));
    const xs = Array.from(uniqueT).sort((a, b) => a - b);
    for (const t of xs) {
      const row: any = { t };
      for (const s of datasets) {
        const found = s.data.find((p) => Number(p.t.toFixed(3)) === t);
        if (found) row[s.trip] = found.v;
      }
      merged.push(row);
    }
    return merged;
  }, [datasets]);
  
  if (!datasets.length) return (
    <Card className="shadow-lg border-2 border-gray-200">
      <CardContent className="p-8 text-center">
        <p className="text-gray-500">No data available for {pidName}</p>
      </CardContent>
    </Card>
  );
  
  return (
    <Card className="shadow-lg border-2 border-gray-200">
      <CardContent className="p-4">
        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="t" 
                label={{ value: "Time (min)", position: "insideBottom", offset: -5 }}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                label={{ value: yLabel, angle: -90, position: "insideLeft" }}
                tick={{ fontSize: 12 }}
              />
              <RTooltip 
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ccc', borderRadius: '8px' }}
              />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              {datasets.map((s, idx) => (
                <Line 
                  key={s.trip} 
                  type="monotone" 
                  dataKey={s.trip} 
                  dot={false} 
                  strokeWidth={2.5}
                  stroke={\`hsl(\${(idx * 137) % 360}, 70%, 50%)\`}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
`;

fs.writeFileSync('src/components/OBDAnalyzer.tsx', code);
console.log('Upgraded OBDAnalyzer component created successfully!');
