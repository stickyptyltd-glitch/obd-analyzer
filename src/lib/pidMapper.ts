// Comprehensive PID recognition and canonicalization

const pidMap: Record<string, string> = {
  "engine speed": "Engine RPM",
  "engine rpm": "Engine RPM",
  "rpm": "Engine RPM",
  "speed (obd)": "Vehicle speed",
  "speed (gps)": "Speed (GPS)",
  "vehicle speed": "Vehicle speed",
  "speed": "Vehicle speed",
  "coolant temp": "Engine coolant temperature",
  "coolant temperature": "Engine coolant temperature",
  "engine coolant temp": "Engine coolant temperature",
  "ect": "Engine coolant temperature",
  "intake air temp": "Intake air temperature",
  "iat": "Intake air temperature",
  "throttle position": "Throttle position",
  "tps": "Throttle position",
  "manifold pressure": "Manifold pressure",
  "map": "Manifold pressure",
  "maf": "MAF air flow rate",
  "mass air flow": "MAF air flow rate",
  "air flow rate": "MAF air flow rate",
  "engine load": "Engine Load",
  "calculated load": "Engine Load",
  "load": "Engine Load",
  "fuel trim bank 1 short term": "STFT",
  "stft": "STFT",
  "short term fuel trim": "STFT",
  "fuel trim bank 1 long term": "LTFT",
  "ltft": "LTFT",
  "long term fuel trim": "LTFT",
  "timing advance": "Timing advance",
  "ignition timing": "Timing advance",
  "spark advance": "Timing advance",
  "o2 sensor": "O2 sensor",
  "oxygen sensor": "O2 sensor",
  "voltage": "Control module voltage",
  "battery voltage": "Control module voltage",
  "control module voltage": "Control module voltage",
  "boost": "Boost pressure",
  "boost pressure": "Boost pressure",
  "turbo pressure": "Boost pressure",
};

export function canonPid(raw: string): string {
  const key = (raw || "").trim().toLowerCase();
  return pidMap[key] || raw;
}

export function getPidCategory(pid: string): string {
  const p = pid.toLowerCase();

  if (p.includes("rpm") || p.includes("load") || p.includes("timing"))
    return "Engine";
  if (p.includes("coolant") || p.includes("temperature") || p.includes("temp"))
    return "Temperature";
  if (
    p.includes("fuel") ||
    p.includes("trim") ||
    p.includes("stft") ||
    p.includes("ltft")
  )
    return "Fuel System";
  if (p.includes("o2") || p.includes("oxygen") || p.includes("catalyst"))
    return "Emissions";
  if (
    p.includes("maf") ||
    p.includes("air") ||
    p.includes("manifold") ||
    p.includes("throttle")
  )
    return "Air Intake";
  if (
    p.includes("voltage") ||
    p.includes("alternator") ||
    p.includes("battery")
  )
    return "Electrical";
  if (p.includes("speed")) return "Vehicle Dynamics";
  if (p.includes("boost") || p.includes("turbo")) return "Forced Induction";
  if (p.includes("misfire") || p.includes("knock")) return "Engine Health";
  if (p.includes("transmission")) return "Transmission";
  if (p.includes("egr") || p.includes("evap")) return "Emissions Control";

  return "Other";
}

export function getPidUnit(pid: string): string {
  const p = pid.toLowerCase();

  if (p.includes("rpm")) return "RPM";
  if (p.includes("temperature") || p.includes("temp")) return "°C";
  if (p.includes("speed")) return "km/h";
  if (p.includes("voltage")) return "V";
  if (p.includes("pressure") && !p.includes("%")) return "kPa";
  if (p.includes("maf") || p.includes("air flow")) return "g/s";
  if (
    p.includes("trim") ||
    p.includes("load") ||
    p.includes("throttle") ||
    p.includes("pedal")
  )
    return "%";
  if (p.includes("o2") && !p.includes("trim")) return "V";
  if (p.includes("timing") || p.includes("advance") || p.includes("retard"))
    return "°";
  if (p.includes("distance")) return "km";
  if (p.includes("time") && !p.includes("timing")) return "s";

  return "";
}
