// Security Research & Vulnerability Assessment Module
//
// ⚠️ LEGAL DISCLAIMER ⚠️
// This module is for AUTHORIZED SECURITY RESEARCH ONLY:
// - Penetration testing with written authorization
// - Academic security research
// - CTF competitions
// - Testing YOUR OWN vehicles
// - Defensive security assessments
//
// UNAUTHORIZED USE IS ILLEGAL. Use only on vehicles you own or have
// explicit written permission to test. Violators will be prosecuted.
//
// These tools DETECT vulnerabilities, they do NOT execute attacks.

import { calculateStdDev, avg, min } from './statistics';
import { type LongRow, type Finding } from './diagnostics';

// Helper function for time-based value lookup
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

// 1. RELAY ATTACK VULNERABILITY DETECTION
export function detectRelayAttackVulnerability(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  // Relay attacks work by amplifying the key fob signal from inside the house
  // to the car, making the car think the key is nearby. Modern systems use
  // time-of-flight (ToF) measurements to detect this.

  const voltageData = rows.filter(r => r.pid === "Control module voltage" && r.value != null);
  const rpmData = rows.filter(r => r.pid === "Engine RPM" && r.value != null);
  const coolantData = rows.filter(r => r.pid === "Engine coolant temperature" && r.value != null);

  if (voltageData.length < 50 || rpmData.length < 50) return findings;

  // Analyze start sequence timing
  const firstVoltages = voltageData.slice(0, 30);
  const firstRPMs = rpmData.slice(0, 50);

  // Calculate time from key detection to engine start
  let keyDetectedIdx = -1;
  let engineStartIdx = -1;

  for (let i = 0; i < firstVoltages.length; i++) {
    const voltage = firstVoltages[i].value!;
    // Voltage drop indicates key system activation
    if (i > 0 && firstVoltages[i - 1].value! - voltage > 0.5) {
      if (keyDetectedIdx === -1) keyDetectedIdx = i;
    }
  }

  for (let i = 0; i < firstRPMs.length; i++) {
    if (firstRPMs[i].value! > 500) {
      engineStartIdx = i;
      break;
    }
  }

  // Check for instant start (no time delay = vulnerable to relay)
  if (keyDetectedIdx !== -1 && engineStartIdx !== -1 && engineStartIdx < 5) {
    findings.push({
      level: "warn",
      category: "Security Research",
      tripId,
      message: "⚠️ VULNERABLE: No key proximity time-of-flight validation detected",
      detail: "This vehicle may be vulnerable to relay attacks. Modern secure systems use ultra-wideband (UWB) time-of-flight to measure actual key distance. Vehicles without ToF can be started by relay amplification. Recommendation: Faraday pouch for key fob, steering wheel lock, or UWB security upgrade.",
      pid: "Immobilizer Security"
    });
  }

  // Check if system uses rolling codes
  const startAttempts = firstRPMs.filter(r => r.value! > 100 && r.value! < 500).length;

  if (startAttempts === 0) {
    findings.push({
      level: "info",
      category: "Security Research",
      tripId,
      message: "Single-attempt start detected - rolling code system likely present",
      detail: "Vehicle appears to use rolling/hopping codes (KeeLoq, HCS, or similar). These prevent simple replay attacks but not relay amplification. Check if vehicle has UWB (Ultra-Wideband) for relay attack protection.",
      pid: "Immobilizer Security"
    });
  }

  // Detect old fixed-code systems (extremely vulnerable)
  if (startAttempts > 3) {
    findings.push({
      level: "fail",
      category: "Security Research",
      tripId,
      message: "⚠️ CRITICAL: Multiple start attempts suggest fixed-code or weak crypto",
      detail: "This pattern indicates a potentially vulnerable immobilizer system. Could be: fixed code (pre-1995), weak rolling code implementation, or low-entropy RNG. Highly vulnerable to code-grabbing, replay attacks, and brute force. Professional security audit recommended.",
      pid: "Immobilizer Security"
    });
  }

  // Check for PKES (Passive Keyless Entry & Start) vs traditional key
  const hasInstantStart = engineStartIdx < 10 && keyDetectedIdx < 5;

  if (hasInstantStart) {
    findings.push({
      level: "info",
      category: "Security Research",
      tripId,
      message: "PKES (Push-to-Start) system detected",
      detail: "Passive Keyless Entry & Start systems are convenience features but introduce security risks: relay attacks (key fob amplification), signal jamming, CAN bus injection. Mitigation: UWB technology (2022+ models), motion sensors in key, signal sleep mode.",
      pid: "Keyless System"
    });
  }

  return findings;
}

// 2. REPLAY ATTACK VULNERABILITY DETECTION
export function detectReplayAttackVulnerability(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  // Replay attacks capture and retransmit key fob signals
  // Modern systems use rolling codes that change with each transmission

  const rpmData = rows.filter(r => r.pid === "Engine RPM" && r.value != null);
  const voltageData = rows.filter(r => r.pid === "Control module voltage" && r.value != null);

  if (rpmData.length < 50) return findings;

  // Analyze for evidence of code synchronization (rolling code system)
  const firstRPMs = rpmData.slice(0, 100);

  // Count micro-starts (failed authentication attempts)
  let microStarts = 0;
  for (let i = 1; i < firstRPMs.length; i++) {
    const prev = firstRPMs[i - 1].value!;
    const curr = firstRPMs[i].value!;

    // Cranking attempts that stop quickly (auth failure)
    if (prev < 100 && curr > 200 && curr < 600) {
      let sustained = false;
      for (let j = i; j < Math.min(i + 10, firstRPMs.length); j++) {
        if (firstRPMs[j].value! > 600) {
          sustained = true;
          break;
        }
      }
      if (!sustained) microStarts++;
    }
  }

  if (microStarts > 5) {
    findings.push({
      level: "warn",
      category: "Security Research",
      tripId,
      message: "⚠️ Multiple failed start attempts - weak rolling code implementation",
      detail: `Detected ${microStarts} failed authentication attempts. This suggests: (1) Out-of-sync rolling codes, (2) Weak implementation allowing brute force, or (3) Replay attack mitigation working correctly. Test with: KeeLoq analyzer, HackRF for signal capture, or professional automotive security tool.`,
      pid: "Immobilizer Security"
    });
  }

  // Check for consistent start pattern (indicates strong crypto)
  if (microStarts === 0 && firstRPMs.length > 50) {
    const avgFirstRPM = avg(firstRPMs.slice(0, 20).map(r => r.value!))!;

    if (avgFirstRPM > 500) {
      findings.push({
        level: "info",
        category: "Security Research",
        tripId,
        message: "✓ Strong authentication detected - clean start sequence",
        detail: "No failed authentication attempts observed. Vehicle likely uses: modern rolling code (KeeLoq 2.0, Megamos Crypto, or AES-based), challenge-response authentication, or PKI. Resistant to basic replay attacks. May still be vulnerable to: advanced cryptanalysis, side-channel attacks, or physical key extraction.",
        pid: "Immobilizer Security"
      });
    }
  }

  // Detect vehicles with no immobilizer (pre-1995 or disabled)
  const firstVoltages = voltageData.slice(0, 20);
  let noAuthDelay = false;

  if (firstVoltages.length > 10) {
    const minVoltage = min(firstVoltages.map(v => v.value!))!;
    const hasImmediateStart = firstRPMs.length > 10 && firstRPMs[5].value! > 500;

    if (minVoltage > 11 && hasImmediateStart) {
      noAuthDelay = true;
    }
  }

  if (noAuthDelay) {
    findings.push({
      level: "fail",
      category: "Security Research",
      tripId,
      message: "⚠️ CRITICAL: No immobilizer authentication delay detected",
      detail: "Vehicle starts immediately without authentication handshake. This indicates: (1) No immobilizer system (pre-1995 vehicle), (2) Immobilizer bypassed/disabled, or (3) Aftermarket bypass module installed. EXTREMELY VULNERABLE to: hot-wiring, CAN injection, ECU replacement, simple relay attacks, replay attacks. Professional security audit URGENTLY recommended.",
      pid: "Immobilizer Security"
    });
  }

  return findings;
}

// 3. CAN BUS INJECTION VULNERABILITY
export function detectCANInjectionVulnerability(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  // CAN bus injection allows attackers to send arbitrary commands to vehicle ECUs
  // Modern vehicles should have authentication on critical CAN messages

  const allPids = new Set(rows.map(r => r.pid));
  const securityPids = [
    "Immobilizer status",
    "Security access",
    "Authentication status",
    "Key validity"
  ];

  // Check if security-related PIDs are available via OBD
  const exposedSecurityPids = securityPids.filter(pid => allPids.has(pid));

  if (exposedSecurityPids.length > 0) {
    findings.push({
      level: "warn",
      category: "Security Research",
      tripId,
      message: `⚠️ Security PIDs exposed via OBD-II: ${exposedSecurityPids.join(", ")}`,
      detail: "Immobilizer/security status readable via diagnostic port. This may allow: security state enumeration, cryptographic challenge interception, or authentication bypass research. Test with: SocketCAN on Linux, python-can library, or Wireshark CAN dissector.",
      pid: "CAN Bus Security"
    });
  }

  // Check for evidence of CAN gateway filtering
  const criticalPids = [
    "Engine RPM", "Throttle position", "Brake status", "Steering angle",
    "Gear position", "Vehicle speed"
  ];

  const availableCritical = criticalPids.filter(pid => allPids.has(pid));

  if (availableCritical.length === criticalPids.length) {
    findings.push({
      level: "info",
      category: "Security Research",
      tripId,
      message: "All critical control PIDs accessible via OBD port",
      detail: "Vehicle exposes full diagnostic access to critical systems. In vehicles without CAN gateway authentication (pre-2017 typically), this allows: CAN injection attacks, ECU spoofing, instrument cluster manipulation. Test with: CANbus Triple, CANtact, or Comma.ai Panda. Mitigation: CAN gateway with MAC authentication (2018+ vehicles).",
      pid: "CAN Bus Security"
    });
  }

  // Detect potential lack of CAN authentication
  const rpmData = rows.filter(r => r.pid === "Engine RPM" && r.value != null);
  const throttleData = rows.filter(r => r.pid === "Throttle position" && r.value != null);

  if (rpmData.length > 100 && throttleData.length > 100) {
    // Check for unrealistic value combinations (potential injection detection)
    let anomalies = 0;

    for (const rpm of rpmData) {
      const throttleNear = nearestValueHelper(throttleData, rpm.timeRaw);
      if (throttleNear != null) {
        // High RPM with closed throttle = impossible in normal operation
        if (rpm.value! > 3000 && throttleNear < 5) {
          anomalies++;
        }
      }
    }

    if (anomalies > 10) {
      findings.push({
        level: "fail",
        category: "Security Research",
        tripId,
        message: `⚠️ ANOMALY: ${anomalies} impossible sensor combinations detected`,
        detail: "Data contains physically impossible sensor readings. This could indicate: (1) CAN bus injection attack in progress, (2) Faulty sensors, (3) ECU malfunction, or (4) Diagnostic tool glitch. For security research: suggests lack of CAN message authentication. Investigate with: CAN bus monitor, logic analyzer, or professional security assessment.",
        pid: "CAN Bus Security"
      });
    }
  }

  return findings;
}

// 4. IMMOBILIZER CRYPTO STRENGTH ANALYSIS
export function analyzeImmobilizerCrypto(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  const rpmData = rows.filter(r => r.pid === "Engine RPM" && r.value != null);
  const voltageData = rows.filter(r => r.pid === "Control module voltage" && r.value != null);

  if (rpmData.length < 50 || voltageData.length < 50) return findings;

  // Analyze authentication handshake timing
  const firstVoltages = voltageData.slice(0, 50).map(v => v.value!);
  const firstRPMs = rpmData.slice(0, 50).map(r => r.value!);

  // Find key-on event (voltage spike)
  let keyOnIdx = -1;
  for (let i = 1; i < firstVoltages.length; i++) {
    if (firstVoltages[i] - firstVoltages[i - 1] > 0.5) {
      keyOnIdx = i;
      break;
    }
  }

  // Find engine start
  let startIdx = -1;
  for (let i = 0; i < firstRPMs.length; i++) {
    if (firstRPMs[i] > 500) {
      startIdx = i;
      break;
    }
  }

  if (keyOnIdx !== -1 && startIdx !== -1) {
    const authTime = (startIdx - keyOnIdx) * 0.1; // Assuming 10Hz sampling

    if (authTime < 0.5) {
      findings.push({
        level: "warn",
        category: "Security Research",
        tripId,
        message: `Very fast authentication (${authTime.toFixed(2)}s) - simple crypto or fixed code`,
        detail: "Authentication completed in under 0.5 seconds. Indicates: fixed code system (pre-1995), simple XOR cipher, or weak rolling code. Systems to test: KeeLoq (crackable with power analysis), Hitag2 (known vulnerabilities), DST40 (broken). Research tools: Proxmark3, ChipWhisperer for side-channel analysis.",
        pid: "Immobilizer Crypto"
      });
    } else if (authTime > 2.0) {
      findings.push({
        level: "info",
        category: "Security Research",
        tripId,
        message: `Slow authentication (${authTime.toFixed(2)}s) - strong cryptography detected`,
        detail: "Extended authentication time suggests: AES-128/256 challenge-response, PKI-based authentication, or Megamos Crypto (AES variant). Modern system likely resistant to: replay attacks, brute force, and simple cryptanalysis. May still be vulnerable to: side-channel attacks (power analysis, EM), fault injection, or supply chain compromise (cloned ECUs).",
        pid: "Immobilizer Crypto"
      });
    }
  }

  // Detect evidence of secure key storage (transponder crypto)
  if (keyOnIdx !== -1) {
    // Check for voltage pattern indicating RFID transponder power-up
    const voltagePattern = firstVoltages.slice(keyOnIdx, keyOnIdx + 10);
    const voltageVariation = calculateStdDev(voltagePattern);

    if (voltageVariation > 0.2) {
      findings.push({
        level: "info",
        category: "Security Research",
        tripId,
        message: "RFID transponder power signature detected",
        detail: "Voltage fluctuation pattern consistent with passive RFID transponder (125kHz or 13.56MHz). Key crypto chips detected: HITAG2/AES, PCF7936 (Philips Crypto), Megamos Crypto, or Texas Instruments DST series. Research: Proxmark3 can clone vulnerable transponders (Hitag2, EM4100). Modern AES transponders require ECU replacement for bypass.",
        pid: "Transponder Security"
      });
    }
  }

  return findings;
}

// 5. KEY FOB SIGNAL STRENGTH & RANGE ANALYSIS
export function analyzeKeyFobSecurity(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  const rpmData = rows.filter(r => r.pid === "Engine RPM" && r.value != null);
  const voltageData = rows.filter(r => r.pid === "Control module voltage" && r.value != null);

  if (voltageData.length < 30) return findings;

  // Analyze for keyless entry activation patterns
  const firstVoltages = voltageData.slice(0, 30);

  // Look for voltage dips indicating proximity sensor activation
  let proximitySensorActivations = 0;
  for (let i = 1; i < firstVoltages.length; i++) {
    const drop = firstVoltages[i - 1].value! - firstVoltages[i].value!;
    if (drop > 0.3 && drop < 0.8) {
      proximitySensorActivations++;
    }
  }

  if (proximitySensorActivations > 3) {
    findings.push({
      level: "warn",
      category: "Security Research",
      tripId,
      message: "Multiple proximity sensor activations - extended detection range",
      detail: `Detected ${proximitySensorActivations} proximity sensor triggers. This indicates: (1) Extended key fob detection range (>2 meters), making relay attacks easier, or (2) High-sensitivity antennas vulnerable to amplification. Mitigation: Reduce antenna gain, implement UWB time-of-flight, add motion sensors to key fob. Test relay vulnerability with: HackRF + YardStick One for signal analysis.`,
      pid: "Keyless Entry Security"
    });
  }

  // Check for always-listening mode (vs motion-activated)
  const startVoltage = firstVoltages[0].value!;
  const hasInstantDetection = proximitySensorActivations > 0 && proximitySensorActivations < 3;

  if (hasInstantDetection && startVoltage > 12.0) {
    findings.push({
      level: "info",
      category: "Security Research",
      tripId,
      message: "Instant key detection - always-on proximity monitoring",
      detail: "Key fob detected immediately without motion trigger. System continuously broadcasts/listens. MORE VULNERABLE to relay attacks. Modern secure systems: motion-activated key fobs (sleep after 1min stationary), UWB with ToF, or BLE with RSSI + ToF. Recommendation: Faraday pouch when not in use.",
      pid: "Keyless Entry Security"
    });
  }

  // Detect evidence of LF (Low Frequency) challenge/response vs RF only
  if (rpmData.length > 20) {
    const authTime = calculateAuthenticationTime(voltageData, rpmData);

    if (authTime > 1.0 && authTime < 3.0) {
      findings.push({
        level: "info",
        category: "Security Research",
        tripId,
        message: "LF/RF challenge-response system detected",
        detail: "Authentication timing suggests dual-frequency system: LF (125kHz) challenge from car, RF (315/433MHz) encrypted response from key. This is MORE SECURE than RF-only but still vulnerable to relay attacks without ToF. Test with: HackRF One for RF, Proxmark3 for LF, or relay attack kit (for authorized testing only).",
        pid: "Key Fob Security"
      });
    }
  }

  return findings;
}

// 6. MANUFACTURER-RESTRICTED FUNCTIONS (Educational Reference)
export function detectRestrictedFunctions(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  // This function provides EDUCATIONAL information about manufacturer-restricted
  // immobilizer functions that Autel and other tools can no longer perform.

  findings.push({
    level: "info",
    category: "Security Research",
    tripId,
    message: "ℹ️ Manufacturer-Restricted Functions (Educational Reference)",
    detail: "Starting 2025, manufacturers are restricting third-party tools from performing: (1) All Keys Lost (AKL) programming, (2) Immobilizer ECU replacement coding, (3) Direct EEPROM key data writing. Affected: Ford (Aug 2025), Toyota/Lexus (AKL removed). Requires: NASTF credentials + OEM software. This trend increases vehicle security but makes independent repair harder.",
    pid: "Regulatory Info"
  });

  findings.push({
    level: "info",
    category: "Security Research",
    tripId,
    message: "ℹ️ Ford Immobilizer Restrictions (Aug 2025)",
    detail: "Ford mandated removal of: Add Key without existing key, AKL programming, direct EEPROM access. Tools affected: Autel IM608, Lonsdor K518, VVDI Key Tool. Workaround: NASTF VSP credentials required. Security justification: Prevents unauthorized key cloning. Impact: Increases repair costs, locks out independent locksmiths.",
    pid: "Ford Security"
  });

  findings.push({
    level: "info",
    category: "Security Research",
    tripId,
    message: "ℹ️ Toyota iKey Proximity System",
    detail: "Toyota/Lexus Smart Key System uses: 125kHz LF challenge, 315/433MHz RF response, encrypted ID authentication, ECU synchronization learning. Common issues: key battery weak, proximity sensor degradation, steering lock actuator failure, ID authentication box desync. Diagnostic: Autel requires 'ECU synchronization learning' for proximity issues. Security: Resistant to basic replay, vulnerable to relay amplification.",
    pid: "Toyota Security"
  });

  return findings;
}

// Helper function to calculate authentication timing
function calculateAuthenticationTime(voltageData: LongRow[], rpmData: LongRow[]): number {
  const firstVoltages = voltageData.slice(0, 30);
  const firstRPMs = rpmData.slice(0, 50);

  let keyOnIdx = -1;
  for (let i = 1; i < firstVoltages.length; i++) {
    if (firstVoltages[i].value! - firstVoltages[i - 1].value! > 0.5) {
      keyOnIdx = i;
      break;
    }
  }

  let startIdx = -1;
  for (let i = 0; i < firstRPMs.length; i++) {
    if (firstRPMs[i].value! > 500) {
      startIdx = i;
      break;
    }
  }

  if (keyOnIdx !== -1 && startIdx !== -1) {
    return (startIdx - keyOnIdx) * 0.1; // Assuming 10Hz sampling
  }

  return 0;
}

// MASTER FUNCTION FOR SECURITY RESEARCH DIAGNOSTICS
export function runSecurityResearchDiagnostics(rows: LongRow[], tripId: string): Finding[] {
  const findings: Finding[] = [];

  // Add legal disclaimer as first finding
  findings.push({
    level: "warn",
    category: "⚠️ LEGAL NOTICE",
    tripId,
    message: "Security Research Mode: Authorized Use Only",
    detail: "These diagnostics detect security vulnerabilities for AUTHORIZED research only. Use only on vehicles you own or have written permission to test. Unauthorized testing, vehicle theft, or using these tools for illegal purposes is a FEDERAL CRIME. By continuing, you affirm you have legal authorization.",
    pid: "Legal Disclaimer"
  });

  findings.push(...detectRelayAttackVulnerability(rows, tripId));
  findings.push(...detectReplayAttackVulnerability(rows, tripId));
  findings.push(...detectCANInjectionVulnerability(rows, tripId));
  findings.push(...analyzeImmobilizerCrypto(rows, tripId));
  findings.push(...analyzeKeyFobSecurity(rows, tripId));
  findings.push(...detectRestrictedFunctions(rows, tripId));

  return findings;
}
