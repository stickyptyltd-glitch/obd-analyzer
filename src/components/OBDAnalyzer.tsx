import React, { useMemo, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  Gauge,
  Battery,
  Thermometer,
  Wind,
  AlertTriangle,
  CheckCircle2,
  Download,
  Settings2,
  Activity,
  Zap,
} from "lucide-react";
import JSZip from "jszip";
import Papa from "papaparse";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { canonPid } from "@/lib/pidMapper";
import {
  runComprehensiveDiagnostics,
  type Finding,
  type LongRow,
  type TripSummary,
} from "@/lib/diagnostics";
import { median, avg, max, min } from "@/lib/statistics";

// Types are imported from @/lib/diagnostics

const unitHeaderRegex = /^(.+?)\s*\(([^)]+)\)\s*$|^(.+)$/;

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
}

async function parseCSVString(
  text: string,
  fileLabel: string,
): Promise<LongRow[]> {
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  if (!parsed || !parsed.meta || !parsed.meta.fields) return [];
  const cols = parsed.meta.fields;
  const rows = parsed.data as any[];
  const hasLong =
    cols.some((c) => c.trim().toLowerCase() === "pid") &&
    cols.some((c) => c.trim().toLowerCase() === "value");
  const timeCol =
    cols.find((c) => ["time", "timestamp", "seconds", "SECONDS"].includes(c)) ||
    cols[0];
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

function minutesFrom(t: number | Date, t0: number | Date): number | null {
  if (t == null || t0 == null) return null;
  const toMs = (x: any) => (x instanceof Date ? x.getTime() : typeof x === "number" ? x * 1000 : Number(new Date(x)));
  const tMs = toMs(t);
  const t0Ms = toMs(t0);
  if (Number.isNaN(tMs) || Number.isNaN(t0Ms)) return null;
  return (tMs - t0Ms) / 60000;
}

function durationFromRows(rows: LongRow[], t0: number | Date | null): number | null {
  if (t0 == null) return null;
  const times = rows.map((r) => r.timeRaw).filter((x) => x != null);
  if (!times.length) return null;
  const toMs = (x: any) => (x instanceof Date ? x.getTime() : typeof x === "number" ? x * 1000 : Number(new Date(x)));
  const t0Ms = toMs(t0);
  let maxMs = t0Ms;
  for (const t of times) {
    const tMs = toMs(t);
    if (!Number.isNaN(tMs) && tMs > maxMs) maxMs = tMs;
  }
  return (maxMs - t0Ms) / 60000;
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

function perTripSummaries(longRows: LongRow[]): {
  summaries: TripSummary[];
  byTrip: Record<string, LongRow[]>;
} {
  const byTrip: Record<string, LongRow[]> = {};
  for (const r of longRows) {
    const id = (r.file || "trip").replace(/\.csv$/i, "");
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
      if (dateTimes.length)
        t0 = new Date(Math.min(...dateTimes.map((d) => d.getTime())));
      else if (numTimes.length) t0 = Math.min(...numTimes);
    }
    const valuesOf = (pid: string) =>
      rows.filter((r) => r.pid === pid && r.value != null).map((r) => r.value!);
    const sp = valuesOf("Vehicle speed");
    const gps = valuesOf("Speed (GPS)");
    const speedAvg = sp.length ? avg(sp) : avg(gps);
    const speedMax = sp.length ? max(sp) : max(gps);
    const ect = valuesOf("Engine coolant temperature");
    const coolantMin = min(ect);
    const coolantMax = max(ect);
    let warmupMin: number | null = null;
    if (ect.length) {
      const series = rows.filter(
        (r) => r.pid === "Engine coolant temperature" && r.value != null,
      );
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
    const mafGs = mafRows
      .map((r) => {
        if (r.value == null) return null;
        const u = (r.units || "").toLowerCase();
        if (u.includes("kg/hour")) return (r.value * 1000) / 3600;
        return r.value;
      })
      .filter((x) => x != null) as number[];
    const mergeSeries = (name: string) =>
      rows
        .filter((r) => r.pid === name && r.value != null)
        .map((r) => ({ t: r.timeRaw, v: r.value! }));
    const speedSeries = mergeSeries("Vehicle speed");
    const rpmSeries = mergeSeries("Engine RPM");
    const mafSeries = rows
      .filter((r) => r.pid === "MAF air flow rate" && r.value != null)
      .map((r) => ({
        t: r.timeRaw,
        v: (r.units || "").toLowerCase().includes("kg/hour")
          ? (r.value! * 1000) / 3600
          : r.value!,
      }));
    const idleCandidates: number[] = [];
    const loadCandidates: number[] = [];
    for (const m of mafSeries) {
      const t = m.t;
      const spNear = nearestValue(speedSeries, t);
      const rpmNear = nearestValue(rpmSeries, t);
      if (spNear == null || rpmNear == null) continue;
      if (spNear >= 0 && spNear < 5 && rpmNear >= 550 && rpmNear <= 950)
        idleCandidates.push(m.v);
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

function runFindings(
  summaries: TripSummary[],
  byTrip: Record<string, LongRow[]>,
): Finding[] {
  const findings: Finding[] = [];
  for (const s of summaries) {
    if (s.coolantMaxC != null && s.coolantMaxC < 82) {
      findings.push({
        level: "warn",
        category: "Coolant System",
        tripId: s.tripId,
        message: `Coolant max only ${s.coolantMaxC.toFixed(1)}°C — possible thermostat stuck open or very short trips.`,
      });
    }
    if (s.coolantMaxC != null && s.coolantMaxC > 105) {
      findings.push({
        level: "fail",
        category: "Coolant System",
        tripId: s.tripId,
        message: `Coolant max ${s.coolantMaxC.toFixed(1)}°C — potential overheating under load.`,
      });
    }
    if (s.warmupTo80CMin != null && s.warmupTo80CMin > 12) {
      findings.push({
        level: "warn",
        category: "Coolant System",
        tripId: s.tripId,
        message: `Warm-up to 80°C took ${s.warmupTo80CMin.toFixed(1)} min — slower than typical.`,
      });
    }
  }
  for (const s of summaries) {
    if (s.stftAvgPct != null && Math.abs(s.stftAvgPct) > 10) {
      findings.push({
        level: "warn",
        category: "Fuel System",
        tripId: s.tripId,
        message: `STFT average ${s.stftAvgPct.toFixed(1)}% — mixture control working hard (vac leak / MAF bias / exhaust leak).`,
      });
    }
    if (s.ltftAvgPct != null && Math.abs(s.ltftAvgPct) > 10) {
      findings.push({
        level: "warn",
        category: "Fuel System",
        tripId: s.tripId,
        message: `LTFT average ${s.ltftAvgPct.toFixed(1)}% — persistent mixture bias over time.`,
      });
    }
  }
  for (const s of summaries) {
    if (s.mafIdleGs != null && (s.mafIdleGs < 1.5 || s.mafIdleGs > 8)) {
      findings.push({
        level: "warn",
        category: "Air Intake",
        tripId: s.tripId,
        message: `Idle MAF ${s.mafIdleGs.toFixed(1)} g/s — atypical for most petrol engines (dirty/faulty MAF or vacuum leak).`,
      });
    }
    if (s.mafLoadGs != null && s.mafLoadGs > 150) {
      findings.push({
        level: "warn",
        category: "Air Intake",
        tripId: s.tripId,
        message: `High-load MAF ${Math.round(s.mafLoadGs)} g/s — unusually high unless hard acceleration.`,
      });
    }
  }
  for (const [tripId, rows] of Object.entries(byTrip)) {
    const rpmSeries = rows.filter(
      (r) => r.pid === "Engine RPM" && r.value != null,
    );
    const vbatSeries = rows.filter(
      (r) => r.pid === "Control module voltage" && r.value != null,
    );
    if (!rpmSeries.length || !vbatSeries.length) continue;
    let lowCount = 0;
    for (const v of vbatSeries) {
      const rpmNear = nearestValue(
        rpmSeries.map((x) => ({ t: x.timeRaw, v: x.value! })),
        v.timeRaw,
      );
      if (rpmNear != null && rpmNear > 500 && (v.value ?? 0) < 12.0) lowCount++;
    }
    if (lowCount > 0)
      findings.push({
        level: "warn",
        category: "Electrical",
        tripId,
        message: `Charging low voltage events: ${lowCount} samples under 12.0V while running.`,
      });
  }
  for (const [tripId, rows] of Object.entries(byTrip)) {
    const glitches = rows.filter(
      (r) => r.pid === "Speed (GPS)" && (r.value ?? 0) > 300,
    ).length;
    if (glitches > 0)
      findings.push({
        level: "info",
        category: "Sensor Data",
        tripId,
        message: `GPS speed spikes detected (${glitches}) — sensor noise.`,
      });
  }
  return findings;
}

export default function OBDAnalyzerApp() {
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<LongRow[]>([]);
  const [summaries, setSummaries] = useState<TripSummary[]>([]);
  const [byTrip, setByTrip] = useState<Record<string, LongRow[]>>({});
  const [findings, setFindings] = useState<Finding[]>([]);
  const [busy, setBusy] = useState(false);
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
      const cleaned = all.map((r) => ({
        ...r,
        pid: canonPid(r.pid),
        units: r.units || null,
      }));
      setRows(cleaned);
      const { summaries, byTrip } = perTripSummaries(cleaned);
      setSummaries(summaries);
      setByTrip(byTrip);

      // Run comprehensive diagnostics with all 12 detection systems
      const diagnosticResults = runComprehensiveDiagnostics(summaries, byTrip);
      setFindings(diagnosticResults);
    } finally {
      setBusy(false);
    }
  }
  const hasData = summaries.length > 0;
  return (
    <div className="min-h-screen p-6 md:p-10 bg-gray-50">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              OBD Diagnostic Analyzer Pro
            </h1>
            <p className="text-gray-600">
              Comprehensive automotive diagnostics • 12+ detection systems •
              Professional-grade analysis
            </p>
          </div>
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={() => exportCSV("trip_summaries.csv", summaries)}
                    disabled={!hasData}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Summary
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Download per-trip metrics as CSV
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </header>
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-4 items-center">
              <div className="border-2 border-dashed rounded-2xl p-6 text-center bg-white">
                <Upload className="w-10 h-10 mx-auto mb-3" />
                <p className="font-medium">Drop CSV/ZIP files here</p>
                <p className="text-sm text-gray-500 mb-3">
                  Car Scanner exports supported. For .brc, export CSV in the app
                  first.
                </p>
                <Input
                  type="file"
                  multiple
                  onChange={(e) => handleFiles(e.target.files)}
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
                    <span>
                      <strong>12+ Detection Systems:</strong> Misfires, O2
                      sensors, catalytic converter, transmission, intake leaks,
                      knock/detonation, coolant system, fuel system,
                      turbo/boost, fuel trims, electrical, and more
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>
                      <strong>Advanced Analytics:</strong> Statistical analysis,
                      pattern recognition, correlation detection, spike
                      identification
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>
                      <strong>Professional Reports:</strong> Severity-ranked
                      findings with detailed explanations and repair guidance
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>
                      <strong>100% Private:</strong> All processing happens in
                      your browser - no data uploaded
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
        {busy && (
          <div className="text-sm text-gray-700">
            Processing… This runs entirely on-device.
          </div>
        )}
        {hasData && (
          <div className="space-y-6">
            <SectionTitle
              icon={<Settings2 className="w-5 h-5" />}
              title="Trip Summaries"
              subtitle="Key metrics per uploaded trip"
            />
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {summaries.map((s) => (
                <Card key={s.tripId} className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold truncate" title={s.tripId}>
                        {s.tripId}
                      </div>
                      <Badge variant="secondary">
                        {s.durationMin?.toFixed(1) ?? "-"} min
                      </Badge>
                    </div>
                    <MetricRow
                      icon={<Gauge className="w-4 h-4" />}
                      label="Speed"
                      value={`${fmtNum(s.speedAvgKmh)} avg / ${fmtNum(s.speedMaxKmh)} max km/h`}
                    />
                    <MetricRow
                      icon={<Thermometer className="w-4 h-4" />}
                      label="Coolant"
                      value={`${fmtNum(s.coolantMaxC)}°C max / warmup ${fmtNum(s.warmupTo80CMin)} min`}
                    />
                    <MetricRow
                      icon={<Wind className="w-4 h-4" />}
                      label="MAF"
                      value={`${fmtNum(s.mafIdleGs)} idle / ${fmtNum(s.mafLoadGs)} load g/s`}
                    />
                    <MetricRow
                      icon={<Battery className="w-4 h-4" />}
                      label="Voltage"
                      value={`${fmtNum(s.vbatMin)}–${fmtNum(s.vbatMax)} V`}
                    />
                    <MetricRow
                      icon={<FileSpreadsheet className="w-4 h-4" />}
                      label="Fuel trims"
                      value={`ST ${fmtNum(s.stftAvgPct)}% / LT ${fmtNum(s.ltftAvgPct)}%`}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
            <SectionTitle
              icon={<AlertTriangle className="w-5 h-5" />}
              title="Findings"
              subtitle="Potential problems & heuristics"
            />
            <div className="space-y-3">
              {findings.length === 0 && (
                <div className="text-sm text-green-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> No significant anomalies
                  detected by the rules.
                </div>
              )}
              {findings.map((f, i) => (
                <FindingItem key={i} f={f} />
              ))}
            </div>
            <SectionTitle
              icon={<Gauge className="w-5 h-5" />}
              title="Charts"
              subtitle="Trends per trip (select with legend)"
            />
            <Tabs defaultValue="coolant" className="w-full">
              <TabsList className="mb-3">
                <TabsTrigger value="coolant">Coolant</TabsTrigger>
                <TabsTrigger value="maf">MAF</TabsTrigger>
                <TabsTrigger value="voltage">Voltage</TabsTrigger>
                <TabsTrigger value="trims">Fuel Trims</TabsTrigger>
              </TabsList>
              <TabsContent value="coolant">
                <SeriesChart
                  rows={rows}
                  pidName="Engine coolant temperature"
                  yLabel="°C"
                />
              </TabsContent>
              <TabsContent value="maf">
                <SeriesChart
                  rows={rows}
                  pidName="MAF air flow rate"
                  yLabel="g/s"
                  transform={(v, units) =>
                    units?.toLowerCase().includes("kg/hour")
                      ? (v * 1000) / 3600
                      : v
                  }
                />
              </TabsContent>
              <TabsContent value="voltage">
                <SeriesChart
                  rows={rows}
                  pidName="Control module voltage"
                  yLabel="V"
                />
              </TabsContent>
              <TabsContent value="trims">
                <SeriesChart rows={rows} pidName="STFT" yLabel="%" />
                <div className="h-4" />
                <SeriesChart rows={rows} pidName="LTFT" yLabel="%" />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-xl bg-white shadow-sm">{icon}</div>
      <div>
        <div className="text-lg font-semibold">{title}</div>
        {subtitle && <div className="text-sm text-gray-500">{subtitle}</div>}
      </div>
    </div>
  );
}

function MetricRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <div className="flex items-center gap-2 text-gray-700">
        <span className="text-gray-500">{icon}</span>
        {label}
      </div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function fmtNum(v: number | null | undefined): string {
  return v == null || Number.isNaN(v) ? "-" : String(Number(v.toFixed(1)));
}

function FindingItem({ f }: { f: Finding }) {
  const levelConfig = {
    fail: {
      color: "text-red-800",
      bgColor: "bg-red-50",
      borderColor: "border-red-300",
      badge: "destructive" as const,
    },
    warn: {
      color: "text-amber-800",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-300",
      badge: "secondary" as const,
    },
    info: {
      color: "text-blue-800",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-300",
      badge: "outline" as const,
    },
  };
  const config = levelConfig[f.level];

  return (
    <Card
      className={`shadow-md border-2 ${config.borderColor} ${config.bgColor} hover:shadow-lg transition-shadow`}
    >
      <CardContent className="p-5">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={config.badge} className="font-semibold">
                  {f.level.toUpperCase()}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {f.category}
                </Badge>
                {f.tripId && (
                  <Badge variant="outline" className="text-xs font-mono">
                    {f.tripId}
                  </Badge>
                )}
              </div>
              <p className={`font-semibold ${config.color} text-base`}>
                {f.message}
              </p>
            </div>
          </div>
          {f.detail && (
            <div className="pl-4 border-l-2 border-gray-300">
              <p className="text-sm text-gray-700 leading-relaxed">
                {f.detail}
              </p>
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

function SeriesChart({
  rows,
  pidName,
  yLabel,
  transform,
}: {
  rows: LongRow[];
  pidName: string;
  yLabel: string;
  transform?: (v: number, u?: string | null) => number;
}) {
  const datasets = useMemo(() => {
    const byTrip: Record<string, { t: number; v: number }[]> = {};
    const byTripT0: Record<string, number> = {};
    for (const r of rows) {
      if (r.pid !== pidName || r.value == null) continue;
      const trip = (r.file || "trip").replace(/\.csv$/i, "");
      const val = transform
        ? transform(r.value, r.units ?? undefined)
        : r.value;
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
    const series = Object.entries(byTrip).map(([trip, arr]) => ({
      trip,
      data: arr.sort((a, b) => a.t - b.t),
    }));
    return series;
  }, [rows, pidName, transform]);
  const chartData = useMemo(() => {
    const merged: { t: number; [series: string]: number | undefined }[] = [];
    const uniqueT = new Set<number>();
    for (const s of datasets)
      for (const p of s.data) uniqueT.add(Number(p.t.toFixed(3)));
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
  if (!datasets.length)
    return <div className="text-sm text-gray-500">No data for {pidName}.</div>;
  return (
    <div className="w-full h-72 bg-white rounded-xl shadow-sm p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            label={{
              value: "Time (min)",
              position: "insideBottom",
              offset: -5,
            }}
          />
          <YAxis
            label={{ value: yLabel, angle: -90, position: "insideLeft" }}
          />
          <RTooltip />
          <Legend />
          {datasets.map((s, idx) => (
            <Line
              key={s.trip}
              type="monotone"
              dataKey={s.trip}
              dot={false}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
