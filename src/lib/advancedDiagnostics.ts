// Advanced Automotive Diagnostics - Extended Detection Systems
import {
  calculateStdDev,
  avg,
  min,
  movingAverage,
} from "./statistics";
import { type LongRow, type Finding } from "./diagnostics";

// Helper function to find nearest value in time series
function nearestValueHelper(rows: LongRow[], targetTime: string | number | Date): number | null {
  if (!rows.length) return null;
  const toMs = (x: any) => {
    if (x instanceof Date) return x.getTime();
    if (typeof x === "number") return x * 1000;
    return Number(new Date(x));
  };
  const targetMs = toMs(targetTime);
  let nearest: number | null = null;
  let minDist = Infinity;
  for (const r of rows) {
    const tMs = toMs(r.timeRaw);
    const dist = Math.abs(tMs - targetMs);
    if (dist < minDist && r.value != null) {
      minDist = dist;
      nearest = r.value;
    }
  }
  return nearest;
}

// DRIVETRAIN ANALYSIS
export function analyzeDrivetrain(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  // Analyze speed vs RPM correlation for transmission health
  const speedData = rows.filter(
    (r) => r.pid === "Vehicle speed" && r.value != null,
  );
  const rpmData = rows.filter((r) => r.pid === "Engine RPM" && r.value != null);

  if (speedData.length > 100 && rpmData.length > 100) {
    // Calculate expected gear ratios
    const ratios: number[] = [];
    for (const spd of speedData) {
      const rpmNear = nearestValueHelper(rpmData, spd.timeRaw);
      if (rpmNear && spd.value! > 20 && rpmNear > 1000) {
        ratios.push(rpmNear / spd.value!);
      }
    }

    if (ratios.length > 50) {
      const ratioStdDev = calculateStdDev(ratios);
      const avgRatio = avg(ratios)!;
      const coeffVar = (ratioStdDev / avgRatio) * 100;

      if (coeffVar > 15) {
        findings.push({
          level: "warn",
          category: "Drivetrain",
          tripId,
          message: `Inconsistent gear ratios detected (CV: ${coeffVar.toFixed(1)}%)`,
          detail:
            "Transmission may have worn clutches, torque converter issues, or slipping gears. Monitor for worsening.",
          pid: "Engine RPM",
        });
      }
    }
  }

  // Detect driveline vibration from RPM oscillations at steady speed
  if (speedData.length > 200 && rpmData.length > 200) {
    const steadySpeed = speedData.filter((s) => s.value! > 40 && s.value! < 70);
    if (steadySpeed.length > 100) {
      const steadyRPMs: number[] = [];
      for (const spd of steadySpeed) {
        const rpm = nearestValueHelper(rpmData, spd.timeRaw);
        if (rpm) steadyRPMs.push(rpm);
      }

      if (steadyRPMs.length > 50) {
        const rpmStdDev = calculateStdDev(steadyRPMs);
        if (rpmStdDev > 80) {
          findings.push({
            level: "warn",
            category: "Drivetrain",
            tripId,
            message: `Driveline vibration detected at highway speeds (RPM variation: ${rpmStdDev.toFixed(0)})`,
            detail:
              "Possible worn U-joints, unbalanced driveshaft, or worn CV joints. Can worsen quickly.",
            pid: "Engine RPM",
          });
        }
      }
    }
  }

  return findings;
}

// BRAKE SYSTEM ANALYSIS
export function analyzeBrakeSystem(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  const speedData = rows.filter(
    (r) => r.pid === "Vehicle speed" && r.value != null,
  );
  const throttleData = rows.filter(
    (r) => r.pid === "Throttle position" && r.value != null,
  );

  if (speedData.length < 100) return findings;

  // Detect deceleration events
  const decelerations: { rate: number; fromSpeed: number }[] = [];
  for (let i = 10; i < speedData.length; i++) {
    const speedChange = speedData[i].value! - speedData[i - 10].value!;
    const throttleNear = nearestValueHelper(throttleData, speedData[i].timeRaw);

    if (speedChange < -10 && throttleNear != null && throttleNear < 5) {
      // Braking event
      const decelRate = Math.abs(speedChange / 10); // km/h per second
      decelerations.push({
        rate: decelRate,
        fromSpeed: speedData[i - 10].value!,
      });
    }
  }

  if (decelerations.length > 5) {
    const avgDecel = avg(decelerations.map((d) => d.rate))!;
    const decelStdDev = calculateStdDev(decelerations.map((d) => d.rate));

    if (avgDecel < 3.5) {
      findings.push({
        level: "warn",
        category: "Brake System",
        tripId,
        message: `Weak braking performance detected (avg decel: ${avgDecel.toFixed(1)} km/h/s)`,
        detail:
          "Brakes may have worn pads, glazed rotors, low fluid, or air in lines. Safety issue - inspect immediately.",
        pid: "Vehicle speed",
      });
    }

    if (decelStdDev > 2.0) {
      findings.push({
        level: "warn",
        category: "Brake System",
        tripId,
        message: `Inconsistent braking performance (variation: ${decelStdDev.toFixed(1)})`,
        detail:
          "One or more brake calipers may be sticking, uneven pad wear, or warped rotors.",
        pid: "Vehicle speed",
      });
    }
  }

  return findings;
}

// ENGINE COMPRESSION ESTIMATION
export function estimateCompression(
  rows: LongRow[],
  tripId: string,
): Finding[] {
  const findings: Finding[] = [];

  const loadData = rows.filter(
    (r) => r.pid === "Engine Load" && r.value != null,
  );
  const rpmData = rows.filter((r) => r.pid === "Engine RPM" && r.value != null);
  const mafData = rows.filter(
    (r) => r.pid === "MAF air flow rate" && r.value != null,
  );

  if (loadData.length < 100 || rpmData.length < 100 || mafData.length < 50)
    return findings;

  // At similar RPM and load, MAF should be consistent
  // Low MAF with high load suggests poor compression
  const highLoadSamples: { maf: number; rpm: number; load: number }[] = [];

  for (const ld of loadData) {
    if (ld.value! > 70) {
      const rpmNear = nearestValueHelper(rpmData, ld.timeRaw);
      const mafNear = nearestValueHelper(mafData, ld.timeRaw);

      if (rpmNear && mafNear && rpmNear > 2500 && rpmNear < 3500) {
        highLoadSamples.push({ maf: mafNear, rpm: rpmNear, load: ld.value! });
      }
    }
  }

  if (highLoadSamples.length > 10) {
    const avgMAF = avg(highLoadSamples.map((s) => s.maf))!;
    const avgLoad = avg(highLoadSamples.map((s) => s.load))!;

    // Rough heuristic: at 80% load, 3000 RPM, typical 4-cyl should see 40+ g/s MAF
    const expectedMAF = (avgLoad / 80) * 40;

    if (avgMAF < expectedMAF * 0.7) {
      findings.push({
        level: "fail",
        category: "Engine Health",
        tripId,
        message: `Low airflow at high load suggests compression loss (MAF: ${avgMAF.toFixed(1)} g/s at ${avgLoad.toFixed(0)}% load)`,
        detail:
          "Possible worn piston rings, valve sealing issues, or head gasket leak. Perform compression test.",
        pid: "MAF air flow rate",
      });
    }
  }

  return findings;
}

// EXHAUST RESTRICTION DETECTION
export function detectExhaustRestriction(
  rows: LongRow[],
  tripId: string,
): Finding[] {
  const findings: Finding[] = [];

  const mapData = rows.filter(
    (r) => r.pid === "Manifold pressure" && r.value != null,
  );
  const baroData = rows.filter(
    (r) => r.pid === "Barometric pressure" && r.value != null,
  );
  const loadData = rows.filter(
    (r) => r.pid === "Engine Load" && r.value != null,
  );
  const rpmData = rows.filter((r) => r.pid === "Engine RPM" && r.value != null);

  if (mapData.length < 50 || loadData.length < 50) return findings;

  // At high load, MAP should drop significantly below baro (vacuum)
  // Restricted exhaust causes higher than normal backpressure
  const highLoadMAP: number[] = [];

  for (const ld of loadData) {
    if (ld.value! > 60) {
      const mapNear = nearestValueHelper(mapData, ld.timeRaw);
      const rpmNear = nearestValueHelper(rpmData, ld.timeRaw);

      if (mapNear && rpmNear && rpmNear > 2000 && rpmNear < 4000) {
        highLoadMAP.push(mapNear);
      }
    }
  }

  if (highLoadMAP.length > 10) {
    const avgMAP = avg(highLoadMAP)!;
    const baro =
      baroData.length > 0 ? avg(baroData.map((b) => b.value!))! : 101;

    // At high load, MAP should be 40-60 kPa below baro for naturally aspirated
    const expectedVacuum = baro - avgMAP;

    if (expectedVacuum < 25) {
      findings.push({
        level: "warn",
        category: "Exhaust System",
        tripId,
        message: `Insufficient vacuum at high load (only ${expectedVacuum.toFixed(0)} kPa below atmospheric)`,
        detail:
          "Possible clogged catalytic converter, collapsed exhaust pipe, or restricted muffler. Causes power loss and poor economy.",
        pid: "Manifold pressure",
      });
    }
  }

  return findings;
}

// VALVE TIMING ANALYSIS
export function analyzeValveTiming(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  const timingData = rows.filter(
    (r) => r.pid === "Timing advance" && r.value != null,
  );
  const loadData = rows.filter(
    (r) => r.pid === "Engine Load" && r.value != null,
  );
  const rpmData = rows.filter((r) => r.pid === "Engine RPM" && r.value != null);

  if (timingData.length < 100 || loadData.length < 100) return findings;

  // Analyze timing advance patterns at different loads
  const idleTiming: number[] = [];
  const cruiseTiming: number[] = [];
  const loadTiming: number[] = [];

  for (const t of timingData) {
    const loadNear = nearestValueHelper(loadData, t.timeRaw);
    const rpmNear = nearestValueHelper(rpmData, t.timeRaw);

    if (!loadNear || !rpmNear) continue;

    if (rpmNear > 600 && rpmNear < 1000 && loadNear < 20) {
      idleTiming.push(t.value!);
    } else if (loadNear > 20 && loadNear < 40) {
      cruiseTiming.push(t.value!);
    } else if (loadNear > 60) {
      loadTiming.push(t.value!);
    }
  }

  if (idleTiming.length > 20 && cruiseTiming.length > 20) {
    const avgIdleTiming = avg(idleTiming)!;
    const avgCruiseTiming = avg(cruiseTiming)!;

    // Idle timing typically 10-20° BTDC, cruise 25-35° BTDC
    if (avgIdleTiming < 5) {
      findings.push({
        level: "warn",
        category: "Engine Health",
        tripId,
        message: `Retarded timing at idle (${avgIdleTiming.toFixed(1)}° BTDC)`,
        detail:
          "Possible vacuum leak, faulty timing chain/belt, or VVT system malfunction. Can cause rough idle and poor fuel economy.",
        pid: "Timing advance",
      });
    }

    if (avgCruiseTiming < 15) {
      findings.push({
        level: "warn",
        category: "Engine Health",
        tripId,
        message: `Low timing advance at cruise (${avgCruiseTiming.toFixed(1)}° BTDC)`,
        detail:
          "May indicate knock sensor over-sensitivity, carbon buildup, or ECU calibration issue.",
        pid: "Timing advance",
      });
    }
  }

  return findings;
}

// IGNITION SYSTEM HEALTH
export function analyzeIgnitionSystem(
  rows: LongRow[],
  tripId: string,
): Finding[] {
  const findings: Finding[] = [];

  const rpmData = rows.filter((r) => r.pid === "Engine RPM" && r.value != null);
  const timingData = rows.filter(
    (r) => r.pid === "Timing advance" && r.value != null,
  );

  if (rpmData.length < 200) return findings;

  // Look for RPM drops that could indicate ignition misfires
  const rpmValues = rpmData.map((r) => r.value!);
  const smoothed = movingAverage(rpmValues, 5);

  let dropCount = 0;
  for (let i = 5; i < smoothed.length - 5; i++) {
    const drop = smoothed[i - 1] - smoothed[i];
    if (drop > 100 && rpmValues[i] > 1500) {
      dropCount++;
    }
  }

  if (dropCount > rpmData.length * 0.01) {
    findings.push({
      level: "warn",
      category: "Ignition System",
      tripId,
      message: `Frequent RPM drops detected (${dropCount} events)`,
      detail:
        "Possible weak spark plugs, failing coil packs, or worn plug wires. Can lead to misfires and catalyst damage.",
      pid: "Engine RPM",
    });
  }

  // Analyze timing scatter
  if (timingData.length > 100) {
    const timingValues = timingData.map((t) => t.value!);
    const timingStdDev = calculateStdDev(timingValues);

    if (timingStdDev > 5) {
      findings.push({
        level: "info",
        category: "Ignition System",
        tripId,
        message: `High timing variation detected (σ = ${timingStdDev.toFixed(1)}°)`,
        detail:
          "ECU actively compensating for combustion variations. Monitor for knock or misfire codes.",
        pid: "Timing advance",
      });
    }
  }

  return findings;
}

// COLD START BEHAVIOR
export function analyzeColdStart(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  const coolantData = rows.filter(
    (r) => r.pid === "Engine coolant temperature" && r.value != null,
  );
  const rpmData = rows.filter((r) => r.pid === "Engine RPM" && r.value != null);
  const stftData = rows.filter(
    (r) => (r.pid === "STFT" || r.pid === "STFT Bank 1") && r.value != null,
  );

  if (coolantData.length < 100 || coolantData[0].value! > 50) return findings;

  // This is a cold start - analyze behavior
  const coldPeriod = coolantData.filter((c) => c.value! < 60);
  if (coldPeriod.length < 30) return findings;

  // Get RPM during cold period
  const coldRPMs: number[] = [];
  for (const c of coldPeriod) {
    const rpm = nearestValueHelper(rpmData, c.timeRaw);
    if (rpm && rpm > 500) coldRPMs.push(rpm);
  }

  if (coldRPMs.length > 20) {
    const avgColdRPM = avg(coldRPMs)!;
    const coldRPMStdDev = calculateStdDev(coldRPMs);

    if (avgColdRPM < 900) {
      findings.push({
        level: "warn",
        category: "Engine Health",
        tripId,
        message: `Low cold start idle RPM (${avgColdRPM.toFixed(0)} RPM)`,
        detail:
          "Possible IAC valve issue, vacuum leak, or weak fuel pressure. Can cause stalling when cold.",
        pid: "Engine RPM",
      });
    }

    if (coldRPMStdDev > 100) {
      findings.push({
        level: "warn",
        category: "Engine Health",
        tripId,
        message: `Unstable cold idle (RPM variation: ${coldRPMStdDev.toFixed(0)})`,
        detail:
          "Cold enrichment issues, dirty throttle body, or failing IAC valve.",
        pid: "Engine RPM",
      });
    }
  }

  // Check fuel trims during cold start
  const coldTrims: number[] = [];
  for (const c of coldPeriod) {
    const trim = nearestValueHelper(stftData, c.timeRaw);
    if (trim != null) coldTrims.push(trim);
  }

  if (coldTrims.length > 20) {
    const avgColdTrim = avg(coldTrims)!;

    if (Math.abs(avgColdTrim) > 20) {
      findings.push({
        level: "warn",
        category: "Fuel System",
        tripId,
        message: `Extreme fuel trim during cold start (${avgColdTrim.toFixed(1)}%)`,
        detail:
          avgColdTrim > 0
            ? "Running lean when cold - possible injector issues or weak fuel pressure."
            : "Running rich when cold - possible leaking injectors or faulty coolant temp sensor.",
        pid: "STFT",
      });
    }
  }

  return findings;
}

// BATTERY STATE OF HEALTH
export function analyzeBatteryHealth(
  rows: LongRow[],
  tripId: string,
): Finding[] {
  const findings: Finding[] = [];

  const voltageData = rows.filter(
    (r) => r.pid === "Control module voltage" && r.value != null,
  );
  const rpmData = rows.filter((r) => r.pid === "Engine RPM" && r.value != null);

  if (voltageData.length < 100) return findings;

  // Analyze voltage at engine start (first 30 seconds)
  const startVoltage = voltageData.slice(0, 30);
  const runningVoltage = voltageData.slice(30);

  if (startVoltage.length > 5 && runningVoltage.length > 50) {
    const minStartVoltage = min(startVoltage.map((v) => v.value!))!;
    const avgRunningVoltage = avg(runningVoltage.map((v) => v.value!))!;

    // Voltage should recover quickly after start
    const recoveryTime = startVoltage.findIndex((v) => v.value! > 13.5);

    if (minStartVoltage < 11.5) {
      findings.push({
        level: "warn",
        category: "Battery/Electrical",
        tripId,
        message: `Low cranking voltage (${minStartVoltage.toFixed(1)}V)`,
        detail:
          "Battery may be weak, has high internal resistance, or poor connections. Test battery and clean terminals.",
        pid: "Control module voltage",
      });
    }

    if (recoveryTime > 20 || recoveryTime === -1) {
      findings.push({
        level: "warn",
        category: "Battery/Electrical",
        tripId,
        message: "Slow voltage recovery after start",
        detail:
          "Weak battery or failing alternator. Battery may not hold charge well.",
        pid: "Control module voltage",
      });
    }

    // Check for voltage ripple (alternator diode health)
    const runningVoltageSamples = runningVoltage.map((v) => v.value!);
    const voltageStdDev = calculateStdDev(runningVoltageSamples);

    if (voltageStdDev > 0.5) {
      findings.push({
        level: "warn",
        category: "Electrical",
        tripId,
        message: `High voltage ripple detected (σ = ${voltageStdDev.toFixed(2)}V)`,
        detail:
          "Alternator may have failing diodes. Can cause electrical noise and damage sensitive electronics.",
        pid: "Control module voltage",
      });
    }
  }

  return findings;
}

// TURBO RESPONSE ANALYSIS
export function analyzeTurboResponse(
  rows: LongRow[],
  tripId: string,
): Finding[] {
  const findings: Finding[] = [];

  const boostData = rows.filter(
    (r) => r.pid === "Boost pressure" && r.value != null,
  );
  const throttleData = rows.filter(
    (r) => r.pid === "Throttle position" && r.value != null,
  );
  const rpmData = rows.filter((r) => r.pid === "Engine RPM" && r.value != null);

  if (boostData.length < 50) return findings;

  // Detect throttle tip-in events and measure boost response
  const boostEvents: { lagTime: number; peakBoost: number }[] = [];

  for (let i = 10; i < throttleData.length - 50; i++) {
    const throttleChange = throttleData[i].value! - throttleData[i - 5].value!;

    if (throttleChange > 40) {
      // Sudden throttle opening
      const rpmNear = nearestValueHelper(rpmData, throttleData[i].timeRaw);
      if (!rpmNear || rpmNear < 2000) continue;

      // Measure time to reach positive boost
      let lagSamples = 0;
      let peakBoost = 0;

      for (let j = i; j < Math.min(i + 50, boostData.length); j++) {
        const boost = nearestValueHelper(boostData, throttleData[j].timeRaw);
        if (boost != null) {
          if (boost > 10 && lagSamples === 0) {
            lagSamples = j - i;
          }
          if (boost > peakBoost) peakBoost = boost;
        }
      }

      if (lagSamples > 0) {
        boostEvents.push({ lagTime: lagSamples * 0.1, peakBoost });
      }
    }
  }

  if (boostEvents.length > 3) {
    const avgLag = avg(boostEvents.map((e) => e.lagTime))!;
    const avgPeak = avg(boostEvents.map((e) => e.peakBoost))!;

    if (avgLag > 2.0) {
      findings.push({
        level: "warn",
        category: "Forced Induction",
        tripId,
        message: `Excessive turbo lag detected (${avgLag.toFixed(1)}s response time)`,
        detail:
          "Possible boost leak, stuck wastegate, worn turbo bearings, or small turbo for engine size.",
        pid: "Boost pressure",
      });
    }

    if (avgPeak < 50) {
      findings.push({
        level: "warn",
        category: "Forced Induction",
        tripId,
        message: `Low peak boost pressure (${avgPeak.toFixed(0)} kPa)`,
        detail:
          "Check for boost leaks, wastegate stuck open, or failing turbocharger.",
        pid: "Boost pressure",
      });
    }
  }

  return findings;
}

// HELPER FUNCTION

// MASTER FUNCTION FOR ADVANCED DIAGNOSTICS
export function runAdvancedDiagnostics(
  rows: LongRow[],
  tripId: string,
): Finding[] {
  const findings: Finding[] = [];

  findings.push(...analyzeDrivetrain(rows, tripId));
  findings.push(...analyzeBrakeSystem(rows, tripId));
  findings.push(...estimateCompression(rows, tripId));
  findings.push(...detectExhaustRestriction(rows, tripId));
  findings.push(...analyzeValveTiming(rows, tripId));
  findings.push(...analyzeIgnitionSystem(rows, tripId));
  findings.push(...analyzeColdStart(rows, tripId));
  findings.push(...analyzeBatteryHealth(rows, tripId));
  findings.push(...analyzeTurboResponse(rows, tripId));

  return findings;
}
