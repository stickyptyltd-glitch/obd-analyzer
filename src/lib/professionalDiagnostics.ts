// Professional-Grade Diagnostics - Autel-Inspired Advanced Detection
import { calculateStdDev, avg, max, min, movingAverage, countTransitions } from './statistics';
import { type LongRow, type Finding } from './diagnostics';

// Helper function to find nearest value by time
function nearestValueHelper(data: LongRow[], timeRaw: any): number | null {
  if (!data.length) return null;
  const toMs = (x: any) => (x instanceof Date ? x.getTime() : typeof x === "number" ? x * 1000 : Number(new Date(x)));
  const tt = toMs(timeRaw);
  let best: number | null = null;
  let bestDist = Infinity;
  for (const d of data) {
    const dist = Math.abs(toMs(d.timeRaw) - tt);
    if (dist < bestDist) {
      bestDist = dist;
      best = d.value!;
    }
  }
  return best;
}

// 1. CAN BUS HEALTH ANALYSIS
export function analyzeCANBusHealth(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  // Look for communication errors and missing data patterns
  const allPids = new Set(rows.map(r => r.pid));
  const criticalPids = [
    "Engine RPM", "Vehicle speed", "Engine coolant temperature",
    "Throttle position", "MAF air flow rate", "Engine Load"
  ];

  const missingCritical: string[] = [];
  for (const pid of criticalPids) {
    if (!allPids.has(pid)) {
      missingCritical.push(pid);
    }
  }

  if (missingCritical.length > 0) {
    findings.push({
      level: "warn",
      category: "CAN Bus / Communication",
      tripId,
      message: `Missing critical PIDs: ${missingCritical.join(", ")}`,
      detail: "CAN bus communication issues, faulty modules, or scanner compatibility problems. Check module connections and scan tool capabilities.",
      pid: "CAN Bus"
    });
  }

  // Detect data dropout patterns (sudden gaps in timestamps)
  const timeStamps = rows.map(r => r.timeRaw).sort();
  let largeGaps = 0;

  for (let i = 1; i < timeStamps.length; i++) {
    const prev = timeStamps[i - 1];
    const curr = timeStamps[i];

    const toMs = (x: any) => (x instanceof Date ? x.getTime() : typeof x === "number" ? x * 1000 : Number(new Date(x)));
    const gap = toMs(curr) - toMs(prev);

    if (gap > 5000) { // More than 5 second gap
      largeGaps++;
    }
  }

  if (largeGaps > 10) {
    findings.push({
      level: "warn",
      category: "CAN Bus / Communication",
      tripId,
      message: `${largeGaps} data dropout events detected`,
      detail: "Intermittent CAN bus communication. Check wiring, connectors, OBD port condition, and module power supplies.",
      pid: "CAN Bus"
    });
  }

  return findings;
}

// 2. CYLINDER BALANCE / POWER CONTRIBUTION
export function analyzeCylinderBalance(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  const rpmData = rows.filter(r => r.pid === "Engine RPM" && r.value != null);
  const loadData = rows.filter(r => r.pid === "Engine Load" && r.value != null);

  if (rpmData.length < 200) return findings;

  // Analyze RPM variations at idle to detect uneven cylinder contribution
  const idleRPMs: number[] = [];
  for (const rpm of rpmData) {
    const loadNear = nearestValueHelper(loadData, rpm.timeRaw);
    if (loadNear != null && loadNear < 20 && rpm.value! > 600 && rpm.value! < 1100) {
      idleRPMs.push(rpm.value!);
    }
  }

  if (idleRPMs.length > 100) {
    // Apply power balance analysis using FFT-like frequency detection
    const smoothed = movingAverage(idleRPMs, 5);
    const oscillations: number[] = [];

    for (let i = 1; i < smoothed.length; i++) {
      oscillations.push(Math.abs(smoothed[i] - smoothed[i - 1]));
    }

    const avgOscillation = avg(oscillations)!;
    const maxOscillation = max(oscillations)!;

    if (avgOscillation > 15) {
      findings.push({
        level: "warn",
        category: "Cylinder Balance",
        tripId,
        message: `Uneven cylinder power contribution detected (avg variation: ${avgOscillation.toFixed(1)} RPM)`,
        detail: "One or more cylinders producing less power. Check spark plugs, injectors, compression, and valve timing. Professional cylinder balance test recommended.",
        pid: "Engine RPM"
      });
    }

    if (maxOscillation > 50) {
      findings.push({
        level: "fail",
        category: "Cylinder Balance",
        tripId,
        message: `Severe cylinder imbalance (peak variation: ${maxOscillation.toFixed(0)} RPM)`,
        detail: "Critical - one cylinder likely dead or severely misfiring. Can damage catalytic converter. Immediate diagnosis required.",
        pid: "Engine RPM"
      });
    }
  }

  return findings;
}

// 3. ENHANCED SENSOR HEALTH SCORING
export function scoreSensorHealth(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  // Score each critical sensor based on response patterns
  const sensors = [
    { pid: "O2 Sensor Bank 1 Sensor 1", name: "O2 Sensor B1S1", expected: { min: 0.1, max: 0.9, transitions: 20 } },
    { pid: "O2 Sensor Bank 1 Sensor 2", name: "O2 Sensor B1S2", expected: { min: 0.4, max: 0.6, transitions: 5 } },
    { pid: "Engine coolant temperature", name: "Coolant Temp Sensor", expected: { min: 80, max: 105, transitions: 10 } },
    { pid: "Intake air temperature", name: "IAT Sensor", expected: { min: 20, max: 60, transitions: 15 } },
    { pid: "MAF air flow rate", name: "MAF Sensor", expected: { min: 2, max: 100, transitions: 50 } },
    { pid: "Throttle position", name: "TPS", expected: { min: 0, max: 90, transitions: 30 } }
  ];

  for (const sensor of sensors) {
    const sensorData = rows.filter(r => r.pid === sensor.pid && r.value != null);

    if (sensorData.length < 50) continue;

    const values = sensorData.map(d => d.value!);
    const minVal = min(values)!;
    const maxVal = max(values)!;
    const range = maxVal - minVal;
    const stdDev = calculateStdDev(values);
    const transitions = countTransitions(values, 0.1);

    let healthScore = 100;
    let issues: string[] = [];

    // Check range
    if (range < (sensor.expected.max - sensor.expected.min) * 0.3) {
      healthScore -= 30;
      issues.push("limited range");
    }

    // Check for stuck/frozen sensor
    if (stdDev < 0.5 && sensor.pid.includes("O2")) {
      healthScore -= 40;
      issues.push("stuck/frozen");
    }

    // Check transition rate
    if (transitions < sensor.expected.transitions * 0.3) {
      healthScore -= 20;
      issues.push("slow response");
    }

    // Check for excessive noise
    if (stdDev > (sensor.expected.max - sensor.expected.min) * 0.5) {
      healthScore -= 25;
      issues.push("excessive noise");
    }

    if (healthScore < 70) {
      const level = healthScore < 50 ? "fail" : "warn";
      findings.push({
        level,
        category: "Sensor Health",
        tripId,
        message: `${sensor.name} health score: ${healthScore}/100 (${issues.join(", ")})`,
        detail: `Sensor showing degraded performance. ${level === "fail" ? "Replacement recommended." : "Monitor for worsening."}`,
        pid: sensor.pid
      });
    }
  }

  return findings;
}

// 4. PREDICTIVE FAILURE ANALYSIS
export function predictiveFailureAnalysis(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  // Trend analysis for gradual degradation patterns
  const coolantData = rows.filter(r => r.pid === "Engine coolant temperature" && r.value != null);
  const voltageData = rows.filter(r => r.pid === "Control module voltage" && r.value != null);
  const o2Data = rows.filter(r => r.pid === "O2 Sensor Bank 1 Sensor 1" && r.value != null);

  // Predict thermostat failure from warmup patterns
  if (coolantData.length > 100) {
    const first30 = coolantData.slice(0, 30).map(d => d.value!);
    const last30 = coolantData.slice(-30).map(d => d.value!);

    const avgFirst = avg(first30)!;
    const avgLast = avg(last30)!;
    const tempRise = avgLast - avgFirst;

    if (avgFirst > 60 && tempRise < 15) {
      findings.push({
        level: "info",
        category: "Predictive Analysis",
        tripId,
        message: "Thermostat may be failing soon (gradual warmup decline detected)",
        detail: "Engine taking longer to warm up over time. Monitor warmup times. Thermostat replacement may be needed in next 3-6 months.",
        pid: "Engine coolant temperature"
      });
    }
  }

  // Predict alternator failure from voltage trends
  if (voltageData.length > 100) {
    const runningVoltages = voltageData.slice(30).map(d => d.value!);
    const avgVoltage = avg(runningVoltages)!;
    const voltageStdDev = calculateStdDev(runningVoltages);

    if (avgVoltage < 13.8 && avgVoltage > 13.0) {
      findings.push({
        level: "info",
        category: "Predictive Analysis",
        tripId,
        message: `Alternator output declining (avg: ${avgVoltage.toFixed(2)}V)`,
        detail: "Charging voltage below optimal. Alternator brushes or diodes may be wearing. Consider testing and replacement within 6 months.",
        pid: "Control module voltage"
      });
    }

    if (voltageStdDev > 0.3 && voltageStdDev < 0.5) {
      findings.push({
        level: "info",
        category: "Predictive Analysis",
        tripId,
        message: "Early signs of alternator diode degradation detected",
        detail: "Voltage ripple increasing. One or more diodes may be weakening. Monitor closely and plan alternator service.",
        pid: "Control module voltage"
      });
    }
  }

  // Predict O2 sensor failure from response degradation
  if (o2Data.length > 100) {
    const o2Values = o2Data.map(d => d.value!);
    const transitions = countTransitions(o2Values, 0.05);
    const transitionRate = transitions / o2Data.length;

    if (transitionRate > 0 && transitionRate < 0.15) {
      findings.push({
        level: "info",
        category: "Predictive Analysis",
        tripId,
        message: "O2 sensor response slowing (early aging detected)",
        detail: "Sensor switching rate declining. Typically indicates contamination or age-related degradation. Plan replacement within 12 months.",
        pid: "O2 Sensor Bank 1 Sensor 1"
      });
    }
  }

  return findings;
}

// 5. EVAP SYSTEM TESTING
export function analyzeEVAPSystem(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  const fuelLevelData = rows.filter(r => r.pid === "Fuel Level" && r.value != null);
  const stftData = rows.filter(r => (r.pid === "STFT" || r.pid === "STFT Bank 1") && r.value != null);
  const ltftData = rows.filter(r => (r.pid === "LTFT" || r.pid === "LTFT Bank 1") && r.value != null);
  const purgeData = rows.filter(r => r.pid === "EVAP purge valve" && r.value != null);

  // Detect fuel tank pressure sensor issues from fuel level stability
  if (fuelLevelData.length > 100) {
    const fuelValues = fuelLevelData.map(d => d.value!);
    const fuelStdDev = calculateStdDev(fuelValues);

    if (fuelStdDev > 5) {
      findings.push({
        level: "warn",
        category: "EVAP System",
        tripId,
        message: `Erratic fuel level readings (variation: ${fuelStdDev.toFixed(1)}%)`,
        detail: "Fuel tank pressure sensor or fuel level sender may be faulty. Can cause EVAP system malfunction codes.",
        pid: "Fuel Level"
      });
    }
  }

  // Detect purge valve stuck open from fuel trim patterns
  if (stftData.length > 100 && ltftData.length > 100) {
    const stftValues = stftData.map(d => d.value!);
    const ltftValues = ltftData.map(d => d.value!);

    const avgSTFT = avg(stftValues)!;
    const avgLTFT = avg(ltftValues)!;

    // Purge valve stuck open causes rich condition (negative trims)
    if (avgSTFT < -15 && avgLTFT < -10) {
      findings.push({
        level: "warn",
        category: "EVAP System",
        tripId,
        message: "EVAP purge valve may be stuck open (excessive negative fuel trims)",
        detail: "Constant fuel vapor entering intake causes rich mixture. Check purge valve solenoid and vacuum lines. Causes poor fuel economy and rough idle.",
        pid: "EVAP purge valve"
      });
    }
  }

  // Detect purge valve stuck closed
  if (purgeData.length > 50) {
    const purgeValues = purgeData.map(d => d.value!);
    const maxPurge = max(purgeValues)!;
    const avgPurge = avg(purgeValues)!;

    if (maxPurge < 5 && avgPurge < 2) {
      findings.push({
        level: "warn",
        category: "EVAP System",
        tripId,
        message: "EVAP purge valve not activating (stuck closed)",
        detail: "ECU commanding purge but valve not responding. Check electrical connections, vacuum lines, and valve solenoid. Will cause EVAP system codes.",
        pid: "EVAP purge valve"
      });
    }
  }

  // Detect large EVAP leak from fuel trim correlation
  if (ltftData.length > 100 && fuelLevelData.length > 50) {
    const ltftValues = ltftData.map(d => d.value!);
    const ltftStdDev = calculateStdDev(ltftValues);
    const avgLTFT = avg(ltftValues)!;

    if (avgLTFT > 20 && ltftStdDev > 8) {
      findings.push({
        level: "fail",
        category: "EVAP System",
        tripId,
        message: "Large EVAP system leak suspected (high positive LTFT variation)",
        detail: "Significant unmetered air entering system. Check gas cap, purge valve, vent valve, and vapor lines for leaks. Can trigger P0455/P0456 codes.",
        pid: "LTFT"
      });
    }
  }

  return findings;
}

// 6. IMMOBILIZER / KEYLESS ENTRY SYSTEM DIAGNOSTICS (Autel-Inspired)
export function analyzeImmobilizerSystem(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  const voltageData = rows.filter(r => r.pid === "Control module voltage" && r.value != null);
  const rpmData = rows.filter(r => r.pid === "Engine RPM" && r.value != null);
  const coolantData = rows.filter(r => r.pid === "Engine coolant temperature" && r.value != null);

  if (voltageData.length < 50 || rpmData.length < 50) return findings;

  // Analyze start sequence for immobilizer issues
  const firstVoltages = voltageData.slice(0, 10).map(v => v.value!);
  const firstRPMs = rpmData.slice(0, 20).map(r => r.value!);

  const minStartVoltage = min(firstVoltages)!;
  const cranking = firstRPMs.filter(r => r > 100 && r < 500).length;
  const started = firstRPMs.filter(r => r > 500).length;

  // Detect extended cranking (possible immobilizer sync issue)
  if (cranking > 10 && started > 0) {
    findings.push({
      level: "warn",
      category: "Immobilizer / Keyless",
      tripId,
      message: "Extended cranking detected - possible key/immobilizer sync issue",
      detail: "Engine cranked longer than normal before starting. May indicate: weak key battery, immobilizer ECU communication delay, or key proximity sensor degradation. Similar to Autel iKey proximity function issues.",
      pid: "Engine RPM"
    });
  }

  // Detect multiple start attempts (immobilizer rejection pattern)
  let startAttempts = 0;
  for (let i = 1; i < rpmData.length && i < 100; i++) {
    const prev = rpmData[i - 1].value!;
    const curr = rpmData[i].value!;

    if (prev < 100 && curr > 200 && curr < 500) {
      startAttempts++;
    }
  }

  if (startAttempts > 2) {
    findings.push({
      level: "fail",
      category: "Immobilizer / Keyless",
      tripId,
      message: `Multiple start attempts detected (${startAttempts} attempts)`,
      detail: "Immobilizer may not recognizing key. Requires ECU synchronization learning (similar to Autel Toyota iKey procedure). Check: key battery, steering lock actuator, smart key ECU communication, authentication ID sync.",
      pid: "Engine RPM"
    });
  }

  // Detect no-start condition (immobilizer lockout)
  const maxRPM = max(firstRPMs)!;
  if (maxRPM < 500 && voltageData.length > 10) {
    findings.push({
      level: "fail",
      category: "Immobilizer / Keyless",
      tripId,
      message: "No-start condition detected - possible immobilizer lockout",
      detail: "Engine not starting despite cranking. Immobilizer may be blocking fuel/ignition. Professional key programming tool required (Autel IM608/IM508). May need: All Keys Lost programming, ECU replacement coding, or NASTF-validated key programming.",
      pid: "Engine RPM"
    });
  }

  // Detect start button/push-to-start issues
  if (coolantData.length > 0) {
    const startTemp = coolantData[0].value!;
    const coldStart = startTemp < 30;

    if (coldStart && cranking > 15) {
      findings.push({
        level: "info",
        category: "Immobilizer / Keyless",
        tripId,
        message: "Cold start extended cranking - keyless proximity detection may be slow",
        detail: "Key proximity sensor response slower in cold weather. Common with keyless/push-button start systems. Ensure key battery is fresh and keep key close to start button.",
        pid: "Engine coolant temperature"
      });
    }
  }

  // Detect battery-related keyless system issues
  if (minStartVoltage < 10.5) {
    findings.push({
      level: "warn",
      category: "Immobilizer / Keyless",
      tripId,
      message: `Very low cranking voltage (${minStartVoltage.toFixed(1)}V) - keyless system at risk`,
      detail: "Keyless entry and immobilizer modules require stable voltage. Low voltage can cause: key not detected, immobilizer faults, steering lock failures. Charge/replace battery before programming keys.",
      pid: "Control module voltage"
    });
  }

  return findings;
}

// 7. ADVANCED THROTTLE BODY ANALYSIS
export function analyzeThrottleBody(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  const throttleData = rows.filter(r => r.pid === "Throttle position" && r.value != null);
  const rpmData = rows.filter(r => r.pid === "Engine RPM" && r.value != null);
  const mafData = rows.filter(r => r.pid === "MAF air flow rate" && r.value != null);

  if (throttleData.length < 100) return findings;

  const throttleValues = throttleData.map(d => d.value!);
  const minThrottle = min(throttleValues)!;

  // Detect throttle blade stuck partially open
  if (minThrottle > 5) {
    findings.push({
      level: "warn",
      category: "Throttle Body",
      tripId,
      message: `Throttle not closing fully (min position: ${minThrottle.toFixed(1)}%)`,
      detail: "Throttle blade sticking open. Causes high idle, poor fuel economy. Clean throttle body with MAF-safe cleaner. May require throttle relearn procedure after cleaning.",
      pid: "Throttle position"
    });
  }

  // Detect carbon buildup from MAF/TPS correlation
  if (mafData.length > 100) {
    const idleThrottles: number[] = [];
    const idleMAFs: number[] = [];

    for (const t of throttleData) {
      if (t.value! < 10) {
        const rpmNear = nearestValueHelper(rpmData, t.timeRaw);
        const mafNear = nearestValueHelper(mafData, t.timeRaw);

        if (rpmNear && mafNear && rpmNear > 600 && rpmNear < 1100) {
          idleThrottles.push(t.value!);
          idleMAFs.push(mafNear);
        }
      }
    }

    if (idleMAFs.length > 30) {
      const avgIdleMAF = avg(idleMAFs)!;
      const avgIdleThrottle = avg(idleThrottles)!;

      // High MAF at low throttle indicates restricted airflow (carbon buildup)
      if (avgIdleMAF > 5 && avgIdleThrottle < 5) {
        findings.push({
          level: "warn",
          category: "Throttle Body",
          tripId,
          message: "Carbon buildup in throttle body suspected",
          detail: "High airflow at closed throttle suggests restricted throttle bore. Clean throttle body and intake. Perform idle relearn after cleaning.",
          pid: "Throttle position"
        });
      }
    }
  }

  return findings;
}

// MASTER FUNCTION FOR PROFESSIONAL DIAGNOSTICS
export function runProfessionalDiagnostics(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  findings.push(...analyzeCANBusHealth(rows, tripId));
  findings.push(...analyzeCylinderBalance(rows, tripId));
  findings.push(...scoreSensorHealth(rows, tripId));
  findings.push(...predictiveFailureAnalysis(rows, tripId));
  findings.push(...analyzeEVAPSystem(rows, tripId));
  findings.push(...analyzeImmobilizerSystem(rows, tripId));
  findings.push(...analyzeThrottleBody(rows, tripId));

  return findings;
}
