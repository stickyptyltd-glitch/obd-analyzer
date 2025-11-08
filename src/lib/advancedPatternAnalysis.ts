/**
 * ADVANCED PATTERN ANALYSIS ENGINE
 *
 * Identifies complex diagnostic patterns and predicts mechanical failures
 * Uses multi-parameter correlation and trend analysis
 */

export interface DataPoint {
  timeRaw: number;
  pid: string;
  value: number;
  file: string;
}

export interface PatternMatch {
  pattern: string;
  confidence: number;
  symptoms: string[];
  likelyRoot: string;
  urgency: "critical" | "high" | "medium" | "low";
  predictedFailure?: string;
  timeToFailure?: string;
  relatedPIDs: string[];
}

export interface TrendAnalysis {
  pid: string;
  trend: "increasing" | "decreasing" | "stable" | "erratic";
  rate: number;
  anomalies: number;
  prediction?: string;
}

// Known fault patterns from real-world diagnostics
const FAULT_PATTERNS = [
  {
    id: "head_gasket_failure",
    name: "Head Gasket Failure Imminent",
    conditions: {
      coolantTemp: { trend: "increasing", threshold: 95 },
      coolantTempVariance: { min: 5 },
      combustionGases: { present: true },
      pressureIncrease: true,
      whiteSmokeIndicator: true
    },
    symptoms: [
      "Coolant temperature rising abnormally",
      "Temperature fluctuations",
      "Pressure in cooling system",
      "Possible white smoke from exhaust",
      "Coolant consumption without visible leaks"
    ],
    urgency: "critical" as const,
    timeToFailure: "1-7 days",
    prediction: "Head gasket failure will occur soon - immediate service required"
  },
  {
    id: "turbo_failure",
    name: "Turbocharger Failure Developing",
    conditions: {
      boostPressure: { dropping: true },
      boostLag: { increasing: true },
      oilConsumption: { high: true },
      exhaustSmoke: { blue: true },
      sealFailure: true
    },
    symptoms: [
      "Boost pressure lower than expected",
      "Increased turbo lag",
      "Blue smoke from exhaust",
      "Oil consumption increasing",
      "Loss of power under acceleration"
    ],
    urgency: "high" as const,
    timeToFailure: "2-4 weeks",
    prediction: "Turbocharger bearing or seal failure progressing"
  },
  {
    id: "catalytic_converter_degradation",
    name: "Catalytic Converter Efficiency Loss",
    conditions: {
      o2UpstreamDownstreamSimilarity: { threshold: 0.8 },
      downstreamSwitching: { active: true },
      backpressure: { high: true },
      efficiencyBelow: 0.5
    },
    symptoms: [
      "Downstream O2 sensor switching like upstream",
      "Reduced fuel economy",
      "Possible sulfur smell",
      "Check engine light intermittent",
      "Loss of power"
    ],
    urgency: "medium" as const,
    timeToFailure: "1-3 months",
    prediction: "Catalytic converter honeycomb deteriorating - will fail emissions"
  },
  {
    id: "fuel_pump_weakening",
    name: "Fuel Pump Pressure Loss",
    conditions: {
      fuelPressure: { dropping: true },
      fuelTrimCompensation: { high: true },
      powerLoss: { underLoad: true },
      pumpNoise: true
    },
    symptoms: [
      "Fuel trims significantly positive (>15%)",
      "Power loss especially uphill or under load",
      "Hesitation during acceleration",
      "Hard starting when hot",
      "Fuel pump whining noise"
    ],
    urgency: "high" as const,
    timeToFailure: "1-2 months",
    prediction: "Fuel pump motor weakening - will fail leaving you stranded"
  },
  {
    id: "transmission_slipping",
    name: "Transmission Clutch/Band Slippage",
    conditions: {
      torqueConverterSlip: { excessive: true },
      transmissionTemp: { high: true },
      shiftFlare: { present: true },
      rpmFlare: { duringShift: true }
    },
    symptoms: [
      "RPM flare during shifts",
      "Transmission temperature elevated",
      "Delayed or harsh shifting",
      "Slipping under load",
      "Burning smell from transmission"
    ],
    urgency: "critical" as const,
    timeToFailure: "days to 2 weeks",
    prediction: "Transmission clutch pack or band failure imminent - stop driving"
  },
  {
    id: "injector_failure",
    name: "Fuel Injector Malfunction",
    conditions: {
      cylinderMisfire: { specific: true },
      fuelTrimImbalance: { bankSpecific: true },
      roughIdle: true,
      fuelOdor: true
    },
    symptoms: [
      "Specific cylinder misfires",
      "Rough idle",
      "Fuel odor from exhaust",
      "Bank-specific fuel trim imbalance",
      "Black smoke or rich condition"
    ],
    urgency: "high" as const,
    timeToFailure: "1-4 weeks",
    prediction: "Fuel injector stuck open or clogged - causing misfire and catalyst damage"
  },
  {
    id: "timing_chain_stretch",
    name: "Timing Chain Excessive Stretch",
    conditions: {
      timingAdvance: { retarded: true },
      camPosError: { increasing: true },
      rattleNoise: { onStartup: true },
      powerLoss: true
    },
    symptoms: [
      "Timing retarded from specification",
      "Rattle noise on cold start",
      "Cam/crank correlation errors",
      "Loss of power",
      "Check engine light for timing"
    ],
    urgency: "critical" as const,
    timeToFailure: "immediate to 1 week",
    prediction: "Timing chain stretched critically - engine damage imminent if chain breaks"
  },
  {
    id: "maf_contamination",
    name: "MAF Sensor Contamination",
    conditions: {
      mafReading: { low: true },
      fuelTrimPositive: { significant: true },
      mafVsCalculatedDiscrepancy: { high: true },
      powerLoss: true
    },
    symptoms: [
      "MAF readings lower than calculated airflow",
      "Positive fuel trims trying to compensate",
      "Poor acceleration",
      "Black smoke possible",
      "Rough idle"
    ],
    urgency: "medium" as const,
    timeToFailure: "1-2 months",
    prediction: "MAF sensor contaminated with oil or dirt - clean or replace before damage"
  },
  {
    id: "egr_valve_stuck",
    name: "EGR Valve Stuck Open",
    conditions: {
      egrFlow: { excessive: true },
      vacuumLeak: { symptoms: true },
      roughIdle: true,
      fuelTrimLean: true
    },
    symptoms: [
      "Rough idle",
      "Stalling at idle",
      "Lean fuel trims at idle",
      "Poor low-end power",
      "Possible misfire at idle"
    ],
    urgency: "medium" as const,
    timeToFailure: "1-3 months",
    prediction: "EGR valve stuck open causing vacuum leak symptoms - clean or replace"
  },
  {
    id: "coil_degradation",
    name: "Ignition Coil Degradation",
    conditions: {
      misfireUnderLoad: { specific: true },
      misfireWhenWet: true,
      weakSpark: true,
      secondaryResistance: { high: true }
    },
    symptoms: [
      "Misfire specific cylinder under load",
      "Worse when raining or humid",
      "Hesitation during acceleration",
      "Check engine light for misfire",
      "Reduced fuel economy"
    ],
    urgency: "high" as const,
    timeToFailure: "2-6 weeks",
    prediction: "Ignition coil breaking down - will cause severe misfire and catalyst damage"
  }
];

export function analyzeTrends(data: DataPoint[]): TrendAnalysis[] {
  const trends: TrendAnalysis[] = [];
  const uniquePIDs = [...new Set(data.map(d => d.pid))];

  for (const pid of uniquePIDs) {
    const pidData = data
      .filter(d => d.pid === pid)
      .sort((a, b) => a.timeRaw - b.timeRaw);

    if (pidData.length < 5) continue;

    const values = pidData.map(d => d.value);
    const times = pidData.map(d => d.timeRaw);

    // Calculate linear regression
    const n = values.length;
    const sumX = times.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = times.reduce((sum, x, i) => sum + x * values[i], 0);
    const sumX2 = times.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgValue = sumY / n;

    // Determine trend
    let trend: TrendAnalysis['trend'];
    if (Math.abs(slope) < avgValue * 0.001) {
      trend = "stable";
    } else if (slope > 0) {
      trend = "increasing";
    } else {
      trend = "decreasing";
    }

    // Detect anomalies (values > 2 std deviations)
    const mean = avgValue;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const anomalies = values.filter(v => Math.abs(v - mean) > 2 * stdDev).length;

    // Check for erratic behavior
    if (anomalies > n * 0.2) {
      trend = "erratic";
    }

    trends.push({
      pid,
      trend,
      rate: slope,
      anomalies,
      prediction: generatePrediction(pid, trend, slope, avgValue)
    });
  }

  return trends;
}

function generatePrediction(pid: string, trend: string, rate: number, avgValue: number): string | undefined {
  if (trend === "stable") return undefined;

  const predictions: Record<string, string> = {
    "Engine coolant temperature_increasing": "Cooling system issue developing - monitor closely",
    "Control module voltage_decreasing": "Battery or alternator weakening - test charging system",
    "STFT_increasing": "Fuel system going lean - check for vacuum leaks or weak fuel pump",
    "LTFT_increasing": "Persistent lean condition - MAF contamination or fuel pressure loss",
    "MAF air flow rate_decreasing": "MAF sensor contamination or intake restriction developing",
    "Intake air temperature_increasing": "Intake system heat soak or cooling issue",
    "O2 Bank 1 Sensor 1_decreasing": "O2 sensor aging or exhaust leak developing",
    "Timing advance_decreasing": "Knock detected or timing chain stretch",
    "Transmission fluid temperature_increasing": "Transmission stress or cooler restriction"
  };

  const key = `${pid}_${trend}`;
  return predictions[key];
}

export function detectComplexPatterns(data: DataPoint[], trends: TrendAnalysis[]): PatternMatch[] {
  const matches: PatternMatch[] = [];

  // Group data by PID for easy access
  const dataByPID: Record<string, number[]> = {};
  data.forEach(d => {
    if (!dataByPID[d.pid]) dataByPID[d.pid] = [];
    dataByPID[d.pid].push(d.value);
  });

  const getValue = (pid: string) => dataByPID[pid] || [];
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const max = (arr: number[]) => arr.length > 0 ? Math.max(...arr) : 0;
  const min = (arr: number[]) => arr.length > 0 ? Math.min(...arr) : 0;
  const variance = (arr: number[]) => {
    const mean = avg(arr);
    return arr.length > 0 ? arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length : 0;
  };

  // Pattern 1: Head Gasket Failure
  const coolant = getValue("Engine coolant temperature");
  const coolantTrend = trends.find(t => t.pid === "Engine coolant temperature");
  if (coolant.length > 0 && coolantTrend) {
    const avgCoolant = avg(coolant);
    const coolantVar = variance(coolant);

    if (avgCoolant > 95 && coolantTrend.trend === "increasing" && coolantVar > 5) {
      matches.push({
        pattern: "head_gasket_failure",
        confidence: 0.85,
        symptoms: FAULT_PATTERNS[0].symptoms,
        likelyRoot: "Head gasket failing - combustion gases entering coolant",
        urgency: "critical",
        predictedFailure: FAULT_PATTERNS[0].prediction,
        timeToFailure: FAULT_PATTERNS[0].timeToFailure,
        relatedPIDs: ["Engine coolant temperature", "Engine load", "Misfire count"]
      });
    }
  }

  // Pattern 2: Turbocharger Failure
  const boost = getValue("Boost pressure");
  const boostTrend = trends.find(t => t.pid === "Boost pressure");
  if (boost.length > 0 && boostTrend) {
    const avgBoost = avg(boost);
    const maxBoost = max(boost);

    if (boostTrend.trend === "decreasing" && avgBoost < -2 && maxBoost < 10) {
      matches.push({
        pattern: "turbo_failure",
        confidence: 0.75,
        symptoms: FAULT_PATTERNS[1].symptoms,
        likelyRoot: "Turbocharger bearing wear or wastegate malfunction",
        urgency: "high",
        predictedFailure: FAULT_PATTERNS[1].prediction,
        timeToFailure: FAULT_PATTERNS[1].timeToFailure,
        relatedPIDs: ["Boost pressure", "MAF air flow rate", "Intake air temperature"]
      });
    }
  }

  // Pattern 3: Catalytic Converter Degradation
  const o2Up = getValue("O2 Bank 1 Sensor 1");
  const o2Down = getValue("O2 Bank 1 Sensor 2");
  if (o2Up.length > 0 && o2Down.length > 0) {
    const upRange = max(o2Up) - min(o2Up);
    const downRange = max(o2Down) - min(o2Down);

    if (downRange > 0.5 && downRange / upRange > 0.8) {
      matches.push({
        pattern: "catalytic_converter_degradation",
        confidence: 0.90,
        symptoms: FAULT_PATTERNS[2].symptoms,
        likelyRoot: "Catalytic converter honeycomb deterioration",
        urgency: "medium",
        predictedFailure: FAULT_PATTERNS[2].prediction,
        timeToFailure: FAULT_PATTERNS[2].timeToFailure,
        relatedPIDs: ["O2 Bank 1 Sensor 1", "O2 Bank 1 Sensor 2", "LTFT"]
      });
    }
  }

  // Pattern 4: Fuel Pump Weakening
  const stft = getValue("STFT");
  const ltft = getValue("LTFT");
  const stftTrend = trends.find(t => t.pid === "STFT");
  const ltftTrend = trends.find(t => t.pid === "LTFT");

  if (stft.length > 0 && ltft.length > 0) {
    const avgSTFT = avg(stft);
    const avgLTFT = avg(ltft);

    if ((avgSTFT > 15 || avgLTFT > 15) && stftTrend?.trend === "increasing") {
      matches.push({
        pattern: "fuel_pump_weakening",
        confidence: 0.70,
        symptoms: FAULT_PATTERNS[3].symptoms,
        likelyRoot: "Fuel pump losing pressure - motor weakening",
        urgency: "high",
        predictedFailure: FAULT_PATTERNS[3].prediction,
        timeToFailure: FAULT_PATTERNS[3].timeToFailure,
        relatedPIDs: ["STFT", "LTFT", "MAF air flow rate", "Engine load"]
      });
    }
  }

  // Pattern 5: Transmission Slipping
  const transSlip = getValue("Torque converter slip");
  const transTemp = getValue("Transmission fluid temperature");
  if (transSlip.length > 0 && transTemp.length > 0) {
    const avgSlip = avg(transSlip);
    const maxTemp = max(transTemp);

    if (avgSlip > 30 && maxTemp > 105) {
      matches.push({
        pattern: "transmission_slipping",
        confidence: 0.95,
        symptoms: FAULT_PATTERNS[4].symptoms,
        likelyRoot: "Transmission clutch pack or band slippage - internal wear",
        urgency: "critical",
        predictedFailure: FAULT_PATTERNS[4].prediction,
        timeToFailure: FAULT_PATTERNS[4].timeToFailure,
        relatedPIDs: ["Torque converter slip", "Transmission fluid temperature", "Engine RPM"]
      });
    }
  }

  // Pattern 6: Specific Cylinder Misfire Pattern
  const cyl1 = getValue("Cylinder 1 misfire");
  const cyl2 = getValue("Cylinder 2 misfire");
  const cyl3 = getValue("Cylinder 3 misfire");
  const cyl4 = getValue("Cylinder 4 misfire");

  const cylinders = [cyl1, cyl2, cyl3, cyl4];
  cylinders.forEach((cyl, idx) => {
    if (cyl.length > 0) {
      const totalMisfire = cyl.reduce((a, b) => a + b, 0);
      if (totalMisfire > 20) {
        matches.push({
          pattern: "injector_failure",
          confidence: 0.80,
          symptoms: [...FAULT_PATTERNS[5].symptoms, `Cylinder ${idx + 1} specific issue`],
          likelyRoot: `Cylinder ${idx + 1}: Injector, coil, or spark plug failure`,
          urgency: "high",
          predictedFailure: `Cylinder ${idx + 1} component failure will damage catalytic converter`,
          timeToFailure: "1-4 weeks",
          relatedPIDs: [`Cylinder ${idx + 1} misfire`, "STFT", "LTFT", "O2 Bank 1 Sensor 1"]
        });
      }
    }
  });

  // Pattern 7: Timing Chain Stretch
  const timing = getValue("Timing advance");
  const timingTrend = trends.find(t => t.pid === "Timing advance");
  if (timing.length > 0 && timingTrend) {
    const avgTiming = avg(timing);

    if (avgTiming < 5 && timingTrend.trend === "decreasing") {
      matches.push({
        pattern: "timing_chain_stretch",
        confidence: 0.75,
        symptoms: FAULT_PATTERNS[6].symptoms,
        likelyRoot: "Timing chain stretched - tensioner failure or wear",
        urgency: "critical",
        predictedFailure: FAULT_PATTERNS[6].prediction,
        timeToFailure: FAULT_PATTERNS[6].timeToFailure,
        relatedPIDs: ["Timing advance", "Engine RPM", "Camshaft position"]
      });
    }
  }

  // Pattern 8: MAF Contamination
  const maf = getValue("MAF air flow rate");
  const mafTrend = trends.find(t => t.pid === "MAF air flow rate");
  if (maf.length > 0 && mafTrend && stft.length > 0) {
    const avgMAF = avg(maf);
    const avgSTFT = avg(stft);

    if (avgMAF < 3 && avgSTFT > 10 && mafTrend.trend === "decreasing") {
      matches.push({
        pattern: "maf_contamination",
        confidence: 0.85,
        symptoms: FAULT_PATTERNS[7].symptoms,
        likelyRoot: "MAF sensor contaminated with oil or dirt",
        urgency: "medium",
        predictedFailure: FAULT_PATTERNS[7].prediction,
        timeToFailure: FAULT_PATTERNS[7].timeToFailure,
        relatedPIDs: ["MAF air flow rate", "STFT", "LTFT", "Throttle position"]
      });
    }
  }

  // Pattern 9: Multiple Correlated Failures (Complex)
  const knockRetard = getValue("Knock retard");
  const iat = getValue("Intake air temperature");
  if (knockRetard.length > 0 && boost.length > 0 && iat.length > 0) {
    const avgKnock = avg(knockRetard.map(Math.abs));
    const avgIAT = avg(iat);
    const avgBoost = avg(boost);

    if (avgKnock > 3 && avgIAT > 50 && avgBoost > 15) {
      matches.push({
        pattern: "heat_soak_detonation",
        confidence: 0.70,
        symptoms: [
          "Knock/detonation under boost",
          "High intake air temperatures",
          "Timing retard active",
          "Power loss under load",
          "Possible pinging noise"
        ],
        likelyRoot: "Intercooler inefficiency or boost pressure too high for fuel octane",
        urgency: "high",
        predictedFailure: "Engine damage from detonation if not corrected - check intercooler and use higher octane",
        timeToFailure: "Immediate risk with each boost event",
        relatedPIDs: ["Knock retard", "Intake air temperature", "Boost pressure", "Timing advance"]
      });
    }
  }

  return matches;
}

export function correlateSymptoms(data: DataPoint[]): string[] {
  const correlations: string[] = [];

  // Multi-parameter correlation analysis
  const dataByPID: Record<string, number[]> = {};
  data.forEach(d => {
    if (!dataByPID[d.pid]) dataByPID[d.pid] = [];
    dataByPID[d.pid].push(d.value);
  });

  const getValue = (pid: string) => dataByPID[pid] || [];
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  // Coolant temp + fuel trim correlation (intake leak vs head gasket)
  const coolant = getValue("Engine coolant temperature");
  const ltft = getValue("LTFT");
  if (coolant.length > 0 && ltft.length > 0) {
    const avgCoolant = avg(coolant);
    const avgLTFT = avg(ltft);

    if (avgCoolant > 95 && avgLTFT < -5) {
      correlations.push("🔴 CORRELATION: High coolant temp + rich fuel trim suggests head gasket leak (coolant into combustion)");
    } else if (avgCoolant < 75 && avgLTFT > 10) {
      correlations.push("🟡 CORRELATION: Low coolant temp + lean fuel trim suggests thermostat stuck open + vacuum leak");
    }
  }

  // MAF vs Load correlation (intake restriction)
  const maf = getValue("MAF air flow rate");
  const load = getValue("Engine load");
  if (maf.length > 0 && load.length > 0) {
    const avgMAF = avg(maf);
    const avgLoad = avg(load);

    if (avgLoad > 70 && avgMAF < 15) {
      correlations.push("🔴 CORRELATION: High load + low MAF indicates severe intake restriction or MAF failure");
    }
  }

  // O2 sensors correlation (exhaust leak detection)
  const o2b1s1 = getValue("O2 Bank 1 Sensor 1");
  const o2b2s1 = getValue("O2 Bank 2 Sensor 1");
  if (o2b1s1.length > 0 && o2b2s1.length > 0) {
    const avgB1 = avg(o2b1s1);
    const avgB2 = avg(o2b2s1);

    if (Math.abs(avgB1 - avgB2) > 0.2) {
      correlations.push("🟡 CORRELATION: O2 sensors reading differently between banks - possible exhaust leak on one bank");
    }
  }

  // Transmission temp + converter slip (clutch failure)
  const transTemp = getValue("Transmission fluid temperature");
  const slip = getValue("Torque converter slip");
  if (transTemp.length > 0 && slip.length > 0) {
    const avgTemp = avg(transTemp);
    const avgSlip = avg(slip);

    if (avgTemp > 100 && avgSlip > 25) {
      correlations.push("🔴 CORRELATION: High trans temp + torque converter slip = clutch/band slippage generating heat - STOP DRIVING");
    }
  }

  return correlations;
}
