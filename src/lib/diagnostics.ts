// Comprehensive OBD Diagnostics Engine
import {
  calculateStdDev,
  calculateVariance,
  countTransitions,
  detectSpikes,
  avg,
  max,
  min,
  percentile,
} from "./statistics";
import { runAdvancedDiagnostics } from "./advancedDiagnostics";
import { runProfessionalDiagnostics } from "./professionalDiagnostics";
import { runSecurityResearchDiagnostics } from "./securityResearch";

export type LongRow = {
  timeRaw: number | string | Date;
  pid: string;
  value: number | null;
  units?: string | null;
  file: string;
};

// Helper function for finding nearest value by time
function nearestValue(series: { t: any; v: number }[], t: any): number | null {
  if (!series || !Array.isArray(series) || series.length === 0) return null;

  const toMs = (x: any): number => {
    try {
      if (x instanceof Date) return x.getTime();
      if (typeof x === "number") return x * 1000;
      const d = new Date(x);
      const ms = d.getTime();
      return isNaN(ms) ? 0 : ms;
    } catch {
      return 0;
    }
  };

  const tt = toMs(t);
  let best: number | null = null;
  let bestDist = Infinity;

  // Limit iterations to prevent stack overflow
  const maxIterations = Math.min(series.length, 10000);
  for (let i = 0; i < maxIterations; i++) {
    const s = series[i];
    if (!s || s.v == null) continue;
    const d = Math.abs(toMs(s.t) - tt);
    if (d < bestDist) {
      bestDist = d;
      best = s.v;
    }
  }
  return best;
}

export type Finding = {
  level: "info" | "warn" | "fail";
  category: string;
  tripId?: string;
  message: string;
  detail?: string;
  pid?: string;
};

export type TripSummary = {
  tripId: string;
  durationMin: number | null;
  speedAvgKmh: number | null;
  speedMaxKmh: number | null;
  coolantMinC: number | null;
  coolantMaxC: number | null;
  warmupTo80CMin: number | null;
  rpmMax: number | null;
  mafIdleGs: number | null;
  mafLoadGs: number | null;
  vbatMin: number | null;
  vbatMax: number | null;
  stftAvgPct: number | null;
  ltftAvgPct: number | null;
};

// 1. MISFIRE DETECTION
export function detectMisfires(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  // Safety check
  if (!rows || !Array.isArray(rows) || rows.length === 0) return findings;

  // Check for individual cylinder misfires
  for (let cyl = 1; cyl <= 8; cyl++) {
    const misfireData = rows.filter(
      (r) => r.pid === `Misfire Cyl ${cyl}` && r.value != null,
    );
    if (misfireData.length > 0) {
      const totalMisfires = misfireData[misfireData.length - 1].value!;
      if (totalMisfires > 0) {
        const level =
          totalMisfires > 50 ? "fail" : totalMisfires > 10 ? "warn" : "info";
        findings.push({
          level,
          category: "Engine Health",
          tripId,
          message: `Cylinder ${cyl} has ${totalMisfires} misfires`,
          detail:
            totalMisfires > 50
              ? "Critical - may damage catalytic converter"
              : "Monitor for worsening condition",
          pid: `Misfire Cyl ${cyl}`,
        });
      }
    }
  }

  // Detect misfires from RPM instability at idle
  const rpmData = rows.filter((r) => r.pid === "Engine RPM" && r.value != null);
  const speedData = rows.filter(
    (r) => r.pid === "Vehicle speed" && r.value != null,
  );

  const idleRPMs: number[] = [];
  for (const rpm of rpmData) {
    const speedNear = nearestValue(
      speedData.map((s) => ({ t: s.timeRaw, v: s.value! })),
      rpm.timeRaw,
    );
    if (
      speedNear != null &&
      speedNear < 5 &&
      rpm.value! > 600 &&
      rpm.value! < 1100
    ) {
      idleRPMs.push(rpm.value!);
    }
  }

  if (idleRPMs.length > 30) {
    const stdDev = calculateStdDev(idleRPMs);
    const coeffVar = (stdDev / avg(idleRPMs)!) * 100;

    if (stdDev > 60 || coeffVar > 8) {
      findings.push({
        level: "warn",
        category: "Engine Health",
        tripId,
        message: `Rough idle detected (RPM variation: ${stdDev.toFixed(0)} RPM, CV: ${coeffVar.toFixed(1)}%)`,
        detail:
          "Possible causes: misfires, vacuum leak, worn engine mounts, dirty throttle body, or bad spark plugs",
        pid: "Engine RPM",
      });
    }
  }

  return findings;
}

// 2. OXYGEN SENSOR ANALYSIS
export function analyzeO2Sensors(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  const sensors = [
    "O2 Bank 1 Sensor 1",
    "O2 Bank 1 Sensor 2",
    "O2 Bank 2 Sensor 1",
    "O2 Bank 2 Sensor 2",
  ];

  for (const sensor of sensors) {
    const o2Data = rows.filter((r) => r.pid === sensor && r.value != null);

    if (o2Data.length > 100) {
      const values = o2Data.map((r) => r.value!);

      // Check switching rate (should be active for upstream sensors)
      const transitions = countTransitions(values, 0.45);
      const transitionsPerSample = transitions / values.length;
      const estimatedSwitchesPerSecond = transitionsPerSample * 10; // assuming ~10Hz sampling

      if (sensor.includes("Sensor 1")) {
        // Upstream sensor should switch rapidly
        if (estimatedSwitchesPerSecond < 1) {
          findings.push({
            level: "warn",
            category: "Emissions",
            tripId,
            message: `${sensor} responding slowly (${estimatedSwitchesPerSecond.toFixed(1)} switches/sec)`,
            detail:
              "Oxygen sensor may be degraded, contaminated, or failing. Can cause poor fuel economy and emissions.",
            pid: sensor,
          });
        }

        // Check for stuck lean/rich
        const avgVoltage = avg(values)!;
        if (avgVoltage < 0.2) {
          findings.push({
            level: "fail",
            category: "Emissions",
            tripId,
            message: `${sensor} stuck lean (avg ${avgVoltage.toFixed(2)}V)`,
            detail:
              "Sensor reporting consistently lean. Possible vacuum leak, low fuel pressure, or failed sensor.",
            pid: sensor,
          });
        } else if (avgVoltage > 0.8) {
          findings.push({
            level: "fail",
            category: "Emissions",
            tripId,
            message: `${sensor} stuck rich (avg ${avgVoltage.toFixed(2)}V)`,
            detail:
              "Sensor reporting consistently rich. Possible clogged air filter, high fuel pressure, or failed sensor.",
            pid: sensor,
          });
        }
      } else if (sensor.includes("Sensor 2")) {
        // Downstream sensor should be relatively stable
        const variance = calculateVariance(values);
        if (variance > 0.1) {
          findings.push({
            level: "warn",
            category: "Emissions",
            tripId,
            message: `${sensor} shows excessive activity (variance: ${variance.toFixed(3)})`,
            detail:
              "Downstream sensor should be stable. Indicates possible catalytic converter degradation.",
            pid: sensor,
          });
        }
      }
    }
  }

  return findings;
}

// 3. CATALYTIC CONVERTER EFFICIENCY
export function checkCatEfficiency(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  const banks = [1, 2];
  for (const bank of banks) {
    const upstream = rows.filter(
      (r) => r.pid === `O2 Bank ${bank} Sensor 1` && r.value != null,
    );
    const downstream = rows.filter(
      (r) => r.pid === `O2 Bank ${bank} Sensor 2` && r.value != null,
    );

    if (upstream.length > 50 && downstream.length > 50) {
      const upstreamVar = calculateVariance(upstream.map((r) => r.value!));
      const downstreamVar = calculateVariance(downstream.map((r) => r.value!));

      if (upstreamVar > 0) {
        const ratio = downstreamVar / upstreamVar;

        if (ratio > 0.5) {
          findings.push({
            level: "fail",
            category: "Emissions",
            tripId,
            message: `Catalytic converter Bank ${bank} efficiency low (ratio: ${ratio.toFixed(2)})`,
            detail:
              "Downstream O2 sensor too active. Cat may be deteriorated or failing. Will cause emissions test failure.",
            pid: `O2 Bank ${bank}`,
          });
        } else if (ratio > 0.3) {
          findings.push({
            level: "warn",
            category: "Emissions",
            tripId,
            message: `Catalytic converter Bank ${bank} efficiency borderline (ratio: ${ratio.toFixed(2)})`,
            detail: "Monitor condition. May need replacement soon.",
            pid: `O2 Bank ${bank}`,
          });
        }
      }
    }
  }

  return findings;
}

// 4. TRANSMISSION HEALTH
export function detectTransmissionIssues(
  rows: LongRow[],
  tripId: string,
): Finding[] {
  const findings: Finding[] = [];

  // Check transmission temperature
  const transTemp = rows.filter(
    (r) => r.pid === "Transmission temperature" && r.value != null,
  );
  if (transTemp.length > 0) {
    const maxTemp = max(transTemp.map((r) => r.value!))!;
    const avgTemp = avg(transTemp.map((r) => r.value!))!;

    if (maxTemp > 120) {
      findings.push({
        level: "fail",
        category: "Transmission",
        tripId,
        message: `Transmission overheating (max: ${maxTemp.toFixed(0)}°C)`,
        detail:
          "Critical temperature reached. Stop driving immediately. Check fluid level and cooler.",
        pid: "Transmission temperature",
      });
    } else if (maxTemp > 110) {
      findings.push({
        level: "warn",
        category: "Transmission",
        tripId,
        message: `Transmission running hot (max: ${maxTemp.toFixed(0)}°C)`,
        detail:
          "Higher than ideal. Check fluid level, consider auxiliary cooler for towing/performance use.",
        pid: "Transmission temperature",
      });
    }
  }

  // Detect slip: RPM spikes without speed increase
  const rpmSeries = rows.filter(
    (r) => r.pid === "Engine RPM" && r.value != null,
  );
  const speedSeries = rows.filter(
    (r) => r.pid === "Vehicle speed" && r.value != null,
  );
  const throttleSeries = rows.filter(
    (r) => r.pid === "Throttle position" && r.value != null,
  );

  if (rpmSeries.length > 100 && speedSeries.length > 100) {
    const rpmValues = rpmSeries.map((r) => r.value!);
    const spikes = detectSpikes(rpmValues, 10, 1.3);

    for (const spikeIdx of spikes) {
      const rpm = rpmSeries[spikeIdx];
      if (rpm.value! > 3000) {
        const speedNear = nearestValue(
          speedSeries.map((s) => ({ t: s.timeRaw, v: s.value! })),
          rpm.timeRaw,
        );
        const speedBefore = nearestValue(
          speedSeries.map((s) => ({ t: s.timeRaw, v: s.value! })),
          rpmSeries[Math.max(0, spikeIdx - 10)].timeRaw,
        );
        const throttleNear = nearestValue(
          throttleSeries.map((t) => ({ t: t.timeRaw, v: t.value! })),
          rpm.timeRaw,
        );

        if (speedNear != null && speedBefore != null && throttleNear != null) {
          const speedChange = Math.abs(speedNear - speedBefore);

          if (speedChange < 3 && throttleNear > 30) {
            findings.push({
              level: "fail",
              category: "Transmission",
              tripId,
              message: `Transmission slip detected (RPM spike to ${rpm.value!.toFixed(0)} with minimal speed change)`,
              detail: `At ${throttleNear.toFixed(0)}% throttle, speed changed only ${speedChange.toFixed(1)} km/h. Indicates clutch wear or hydraulic issues.`,
              pid: "Engine RPM",
            });
            break;
          }
        }
      }
    }
  }

  return findings;
}

// 5. INTAKE SYSTEM ANALYSIS
export function detectIntakeLeaks(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  // Analyze MAF vs load correlation
  const mafData = rows.filter(
    (r) => r.pid === "MAF air flow rate" && r.value != null,
  );
  const loadData = rows.filter(
    (r) => r.pid === "Engine Load" && r.value != null,
  );
  const rpmData = rows.filter((r) => r.pid === "Engine RPM" && r.value != null);

  // At idle, compare manifold pressure expectations with STFT
  const stftData = rows.filter(
    (r) => (r.pid === "STFT" || r.pid === "STFT Bank 1") && r.value != null,
  );

  // High idle STFT can indicate unmetered air (vacuum leak)
  const idleSTFT: number[] = [];
  for (const stft of stftData) {
    const rpmNear = nearestValue(
      rpmData.map((r) => ({ t: r.timeRaw, v: r.value! })),
      stft.timeRaw,
    );
    if (rpmNear != null && rpmNear > 600 && rpmNear < 1000) {
      idleSTFT.push(stft.value!);
    }
  }

  if (idleSTFT.length > 20) {
    const avgIdleSTFT = avg(idleSTFT)!;
    if (avgIdleSTFT > 15) {
      findings.push({
        level: "warn",
        category: "Air Intake",
        tripId,
        message: `High fuel trim at idle (STFT: +${avgIdleSTFT.toFixed(1)}%)`,
        detail:
          "ECU adding significant fuel at idle. Suggests vacuum leak, intake gasket leak, or MAF sensor underreading.",
        pid: "STFT",
      });
    } else if (avgIdleSTFT < -15) {
      findings.push({
        level: "warn",
        category: "Air Intake",
        tripId,
        message: `Low fuel trim at idle (STFT: ${avgIdleSTFT.toFixed(1)}%)`,
        detail:
          "ECU reducing fuel at idle. Suggests dirty/contaminated MAF, clogged air filter, or injector leak.",
        pid: "STFT",
      });
    }
  }

  return findings;
}

// 6. KNOCK/DETONATION DETECTION
export function analyzeKnock(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  const knockData = rows.filter(
    (r) => r.pid === "Knock retard" && r.value != null,
  );

  if (knockData.length > 50) {
    const values = knockData.map((r) => r.value!);
    const avgRetard = avg(values)!;
    const maxRetard = max(values)!;
    const p95Retard = percentile(values, 95)!;

    if (maxRetard > 15) {
      findings.push({
        level: "fail",
        category: "Engine Health",
        tripId,
        message: `Severe detonation detected (max knock retard: ${maxRetard.toFixed(1)}°)`,
        detail:
          "Critical - engine damage risk. Use higher octane fuel immediately. Check for carbon buildup, overheating, or faulty knock sensor.",
        pid: "Knock retard",
      });
    } else if (avgRetard > 4 || p95Retard > 8) {
      findings.push({
        level: "warn",
        category: "Engine Health",
        tripId,
        message: `Excessive knock detected (avg: ${avgRetard.toFixed(1)}°, 95th percentile: ${p95Retard.toFixed(1)}°)`,
        detail:
          "Possible causes: low octane fuel, carbon buildup, EGR issues, overheating, or failing knock sensor.",
        pid: "Knock retard",
      });
    }
  }

  return findings;
}

// 7. COOLANT SYSTEM HEALTH
export function checkCoolantSystem(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  const coolantData = rows.filter(
    (r) => r.pid === "Engine coolant temperature" && r.value != null,
  );
  const rpmData = rows.filter((r) => r.pid === "Engine RPM" && r.value != null);
  const loadData = rows.filter(
    (r) => r.pid === "Engine Load" && r.value != null,
  );

  if (coolantData.length > 60) {
    const temps = coolantData.map((r) => r.value!);

    // Check for rapid temperature rise under load (weak water pump)
    for (let i = 60; i < coolantData.length; i++) {
      const rpmNear = nearestValue(
        rpmData.map((r) => ({ t: r.timeRaw, v: r.value! })),
        coolantData[i].timeRaw,
      );
      const loadNear = nearestValue(
        loadData.map((r) => ({ t: r.timeRaw, v: r.value! })),
        coolantData[i].timeRaw,
      );

      if (
        rpmNear != null &&
        rpmNear > 3000 &&
        loadNear != null &&
        loadNear > 60
      ) {
        const tempBefore = coolantData[i - 60].value!;
        const tempNow = coolantData[i].value!;
        const tempRise = tempNow - tempBefore;

        if (tempRise > 20 && tempNow > 95) {
          findings.push({
            level: "warn",
            category: "Temperature",
            tripId,
            message: `Rapid temperature rise under load (+${tempRise.toFixed(1)}°C in 60 seconds)`,
            detail:
              "Possible weak water pump, low coolant, air in system, or clogged radiator. Check coolant level and flow.",
            pid: "Engine coolant temperature",
          });
          break;
        }
      }
    }

    // Check for temperature cycling (failing thermostat)
    const tempStdDev = calculateStdDev(temps.filter((t) => t > 70)); // Only after warmup
    if (tempStdDev > 8) {
      findings.push({
        level: "warn",
        category: "Temperature",
        tripId,
        message: `Temperature cycling detected (variation: ${tempStdDev.toFixed(1)}°C)`,
        detail:
          "Thermostat may be sticking or failing. Can cause poor fuel economy and increased emissions.",
        pid: "Engine coolant temperature",
      });
    }
  }

  return findings;
}

// 8. FUEL SYSTEM ANALYSIS
export function checkFuelSystem(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  const fuelPressure = rows.filter(
    (r) => r.pid === "Fuel pressure" && r.value != null,
  );
  const rpmData = rows.filter((r) => r.pid === "Engine RPM" && r.value != null);
  const throttleData = rows.filter(
    (r) => r.pid === "Throttle position" && r.value != null,
  );

  if (fuelPressure.length > 50) {
    const pressures = fuelPressure.map((r) => r.value!);
    const minPressure = min(pressures)!;
    const avgPressure = avg(pressures)!;

    // Check for pressure drops under load
    for (const fp of fuelPressure) {
      const rpmNear = nearestValue(
        rpmData.map((r) => ({ t: r.timeRaw, v: r.value! })),
        fp.timeRaw,
      );
      const throttleNear = nearestValue(
        throttleData.map((r) => ({ t: r.timeRaw, v: r.value! })),
        fp.timeRaw,
      );

      if (
        rpmNear != null &&
        rpmNear > 3500 &&
        throttleNear != null &&
        throttleNear > 70
      ) {
        if (fp.value! < 250) {
          // Generic threshold - varies by vehicle
          findings.push({
            level: "warn",
            category: "Fuel System",
            tripId,
            message: `Low fuel pressure under load (${fp.value!.toFixed(0)} kPa @ ${rpmNear.toFixed(0)} RPM)`,
            detail:
              "Weak fuel pump, clogged fuel filter, or failing pressure regulator. Can cause poor performance and lean conditions.",
            pid: "Fuel pressure",
          });
          break;
        }
      }
    }

    if (minPressure < 200) {
      findings.push({
        level: "warn",
        category: "Fuel System",
        tripId,
        message: `Fuel pressure dropped to ${minPressure.toFixed(0)} kPa`,
        detail: "Check fuel pump, filter, and pressure regulator.",
        pid: "Fuel pressure",
      });
    }
  }

  return findings;
}

// 9. TURBO/BOOST ANALYSIS
export function analyzeTurbo(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  const boostData = rows.filter(
    (r) => r.pid === "Boost pressure" && r.value != null,
  );
  const throttleData = rows.filter(
    (r) => r.pid === "Throttle position" && r.value != null,
  );
  const rpmData = rows.filter((r) => r.pid === "Engine RPM" && r.value != null);

  if (boostData.length > 50) {
    // Check for boost leaks: high throttle but low boost
    for (const boost of boostData) {
      const throttleNear = nearestValue(
        throttleData.map((t) => ({ t: t.timeRaw, v: t.value! })),
        boost.timeRaw,
      );
      const rpmNear = nearestValue(
        rpmData.map((r) => ({ t: r.timeRaw, v: r.value! })),
        boost.timeRaw,
      );

      if (
        throttleNear != null &&
        throttleNear > 80 &&
        rpmNear != null &&
        rpmNear > 2500
      ) {
        if (boost.value! < 50) {
          // Threshold varies significantly by vehicle
          findings.push({
            level: "warn",
            category: "Forced Induction",
            tripId,
            message: `Low boost at high throttle (${boost.value!.toFixed(0)} kPa @ ${throttleNear.toFixed(0)}% throttle)`,
            detail:
              "Possible boost leak, stuck wastegate, or turbo failure. Check all intercooler pipes and clamps.",
            pid: "Boost pressure",
          });
          break;
        }
      }
    }

    // Check for overboost
    const maxBoost = max(boostData.map((r) => r.value!))!;
    if (maxBoost > 250) {
      // Generic threshold
      findings.push({
        level: "warn",
        category: "Forced Induction",
        tripId,
        message: `High boost pressure detected (${maxBoost.toFixed(0)} kPa)`,
        detail:
          "Possible wastegate malfunction or boost controller issue. Can cause engine damage.",
        pid: "Boost pressure",
      });
    }
  }

  return findings;
}

// 10. COMPREHENSIVE FUEL TRIM ANALYSIS
export function analyzeFuelTrims(
  rows: LongRow[],
  tripId: string,
  summaries: TripSummary[],
): Finding[] {
  const findings: Finding[] = [];

  // Per-bank analysis
  const banks = [1, 2];
  for (const bank of banks) {
    const stft = rows.filter(
      (r) => r.pid === `STFT Bank ${bank}` && r.value != null,
    );
    const ltft = rows.filter(
      (r) => r.pid === `LTFT Bank ${bank}` && r.value != null,
    );

    if (stft.length > 50) {
      const stftValues = stft.map((r) => r.value!);
      const avgSTFT = avg(stftValues)!;
      const stftRange = max(stftValues)! - min(stftValues)!;

      if (Math.abs(avgSTFT) > 15) {
        findings.push({
          level: "warn",
          category: "Fuel System",
          tripId,
          message: `Bank ${bank} STFT extreme (avg: ${avgSTFT.toFixed(1)}%)`,
          detail:
            avgSTFT > 0
              ? "System running lean. Check for vacuum leaks, low fuel pressure, or MAF issues."
              : "System running rich. Check for high fuel pressure, dirty MAF, or injector issues.",
          pid: `STFT Bank ${bank}`,
        });
      }

      if (stftRange > 35) {
        findings.push({
          level: "info",
          category: "Fuel System",
          tripId,
          message: `Bank ${bank} STFT highly variable (range: ${stftRange.toFixed(1)}%)`,
          detail:
            "Fuel control working hard. May indicate intermittent issue or aggressive driving.",
          pid: `STFT Bank ${bank}`,
        });
      }
    }

    if (ltft.length > 50) {
      const ltftValues = ltft.map((r) => r.value!);
      const avgLTFT = avg(ltftValues)!;

      if (Math.abs(avgLTFT) > 12) {
        findings.push({
          level: "warn",
          category: "Fuel System",
          tripId,
          message: `Bank ${bank} LTFT extreme (avg: ${avgLTFT.toFixed(1)}%)`,
          detail:
            "Persistent trim indicates chronic issue. ECU has adapted significantly over time.",
          pid: `LTFT Bank ${bank}`,
        });
      }
    }
  }

  // Cross-trip LTFT trending
  const allLTFT = summaries
    .map((s) => s.ltftAvgPct)
    .filter((v) => v != null) as number[];
  if (allLTFT.length > 1) {
    const avgAcrossTrips = avg(allLTFT)!;
    if (Math.abs(avgAcrossTrips) > 15) {
      findings.push({
        level: "warn",
        category: "Fuel System",
        tripId: "All trips",
        message: `Chronic fuel trim issue across all trips (avg LTFT: ${avgAcrossTrips.toFixed(1)}%)`,
        detail:
          avgAcrossTrips > 0
            ? "Persistent lean condition. Likely MAF contamination, vacuum leak, or weak fuel pump."
            : "Persistent rich condition. Likely MAF sensor failing, high fuel pressure, or leaking injector.",
        pid: "LTFT",
      });
    }
  }

  return findings;
}

// 11. ELECTRICAL SYSTEM
export function checkElectricalSystem(
  rows: LongRow[],
  tripId: string,
): Finding[] {
  const findings: Finding[] = [];

  const voltageData = rows.filter(
    (r) => r.pid === "Control module voltage" && r.value != null,
  );
  const rpmData = rows.filter((r) => r.pid === "Engine RPM" && r.value != null);

  if (voltageData.length > 50) {
    const voltages = voltageData.map((r) => r.value!);
    const minVoltage = min(voltages)!;
    const maxVoltage = max(voltages)!;

    // Check for charging issues
    let runningLowCount = 0;
    for (const vd of voltageData) {
      const rpmNear = nearestValue(
        rpmData.map((r) => ({ t: r.timeRaw, v: r.value! })),
        vd.timeRaw,
      );
      if (rpmNear != null && rpmNear > 1000 && vd.value! < 13.5) {
        runningLowCount++;
      }
    }

    if (runningLowCount > voltageData.length * 0.1) {
      findings.push({
        level: "warn",
        category: "Electrical",
        tripId,
        message: `Charging system weak (${runningLowCount} samples under 13.5V while running)`,
        detail:
          "Alternator may be failing or belt slipping. Battery not charging properly. Test alternator output.",
        pid: "Control module voltage",
      });
    }

    if (maxVoltage > 15.5) {
      findings.push({
        level: "fail",
        category: "Electrical",
        tripId,
        message: `Overcharging detected (peak: ${maxVoltage.toFixed(1)}V)`,
        detail:
          "Voltage regulator failure. Can damage electronic components and battery. Check alternator immediately.",
        pid: "Control module voltage",
      });
    }

    if (minVoltage < 11.0) {
      findings.push({
        level: "fail",
        category: "Electrical",
        tripId,
        message: `Severe voltage drop (min: ${minVoltage.toFixed(1)}V)`,
        detail:
          "Critical - can cause stalling and ECU resets. Check battery condition, connections, and alternator.",
        pid: "Control module voltage",
      });
    }
  }

  return findings;
}

// 12. GPS/SPEED ANOMALIES
export function checkSpeedAnomalies(
  rows: LongRow[],
  tripId: string,
): Finding[] {
  const findings: Finding[] = [];

  const gpsSpeed = rows.filter(
    (r) => r.pid === "Speed (GPS)" && r.value != null,
  );

  if (gpsSpeed.length > 0) {
    const glitches = gpsSpeed.filter((r) => r.value! > 300).length;
    if (glitches > 0) {
      findings.push({
        level: "info",
        category: "Vehicle Dynamics",
        tripId,
        message: `GPS speed spikes detected (${glitches} samples)`,
        detail:
          "Sensor noise or GPS signal loss. Does not indicate mechanical issue.",
        pid: "Speed (GPS)",
      });
    }
  }

  return findings;
}

// MASTER DIAGNOSTIC FUNCTION
export function runComprehensiveDiagnostics(
  summaries: TripSummary[],
  byTrip: Record<string, LongRow[]>,
): Finding[] {
  const allFindings: Finding[] = [];

  console.log("Starting diagnostics for", Object.keys(byTrip).length, "trips");

  let tripCount = 0;
  for (const [tripId, rows] of Object.entries(byTrip)) {
    tripCount++;
    if (tripCount > 50) {
      console.warn("Too many trips, limiting to first 50");
      break;
    }

    console.log(`Processing trip ${tripCount}: ${tripId}, rows: ${rows.length}`);

    try {
      // Run all 12 core diagnostic modules
      console.log("  - Running detectMisfires");
      allFindings.push(...detectMisfires(rows, tripId));

      console.log("  - Running analyzeO2Sensors");
      allFindings.push(...analyzeO2Sensors(rows, tripId));

      console.log("  - Running checkCatEfficiency");
      allFindings.push(...checkCatEfficiency(rows, tripId));

      console.log("  - Running detectTransmissionIssues");
      allFindings.push(...detectTransmissionIssues(rows, tripId));

      console.log("  - Running detectIntakeLeaks");
      allFindings.push(...detectIntakeLeaks(rows, tripId));

      console.log("  - Running analyzeKnock");
      allFindings.push(...analyzeKnock(rows, tripId));

      console.log("  - Running checkCoolantSystem");
      allFindings.push(...checkCoolantSystem(rows, tripId));

      console.log("  - Running checkFuelSystem");
      allFindings.push(...checkFuelSystem(rows, tripId));

      console.log("  - Running analyzeTurbo");
      allFindings.push(...analyzeTurbo(rows, tripId));

      console.log("  - Running analyzeFuelTrims");
      allFindings.push(...analyzeFuelTrims(rows, tripId, summaries));

      console.log("  - Running checkElectricalSystem");
      allFindings.push(...checkElectricalSystem(rows, tripId));

      console.log("  - Running checkSpeedAnomalies");
      allFindings.push(...checkSpeedAnomalies(rows, tripId));

      // TEMPORARILY DISABLED - Advanced modules causing stack overflow
      // console.log("  - Running runAdvancedDiagnostics");
      // allFindings.push(...runAdvancedDiagnostics(rows, tripId));

      // console.log("  - Running runProfessionalDiagnostics");
      // allFindings.push(...runProfessionalDiagnostics(rows, tripId));

      // console.log("  - Running runSecurityResearchDiagnostics");
      // allFindings.push(...runSecurityResearchDiagnostics(rows, tripId));

    } catch (error) {
      console.error(`Error in diagnostics for trip ${tripId}:`, error);
      allFindings.push({
        level: "fail",
        category: "System Error",
        tripId,
        message: `Diagnostic error: ${error instanceof Error ? error.message : String(error)}`,
        detail: "Some diagnostic modules failed to complete",
      });
    }
  }

  console.log("Total findings:", allFindings.length);

  // Sort by severity
  const severityOrder = { fail: 0, warn: 1, info: 2 };
  allFindings.sort((a, b) => severityOrder[a.level] - severityOrder[b.level]);

  return allFindings;
}
