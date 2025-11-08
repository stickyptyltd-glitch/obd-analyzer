import React, { useState } from "react";

/**
 * RF REPLAY & RELAY ATTACK RESEARCH MODULE
 *
 * AUTHORIZATION REQUIRED:
 * This module is for AUTHORIZED SECURITY RESEARCH ONLY
 * - Licensed automotive security professionals
 * - NASTF certification
 * - Authorized penetration testing engagements
 * - Academic/educational research with proper authorization
 *
 * LEGAL NOTICE:
 * Unauthorized interception or manipulation of vehicle RF signals is ILLEGAL
 * under the Computer Fraud and Abuse Act (CFAA) and similar laws worldwide.
 * Use only on vehicles you own or have written authorization to test.
 */

type RFAttackType = "replay" | "relay" | "jamming" | "amplification" | "code_grabbing";
type VehicleSystem = "keyfob" | "tpms" | "remote_start" | "pke" | "tire_pressure";

interface RFAttack {
  id: string;
  name: string;
  type: RFAttackType;
  targetSystem: VehicleSystem;
  frequency: string;
  description: string;
  difficulty: "Easy" | "Medium" | "Hard" | "Expert";
  equipment: string[];
  vulnerableYears: string;
  mitigations: string[];
  procedure: string[];
  legalStatus: string;
}

const RF_ATTACKS: RFAttack[] = [
  {
    id: "keyfob-replay",
    name: "Key Fob Replay Attack",
    type: "replay",
    targetSystem: "keyfob",
    frequency: "315 MHz / 433 MHz",
    description: "Capture and replay fixed-code key fob signals to unlock/start vehicle",
    difficulty: "Easy",
    equipment: ["HackRF One", "RTL-SDR", "YardStick One", "GNU Radio"],
    vulnerableYears: "Pre-2000 vehicles with fixed code systems",
    mitigations: [
      "Upgrade to rolling code system",
      "Implement challenge-response authentication",
      "Use encryption on RF signals",
      "Add time-based validation"
    ],
    procedure: [
      "1. Identify target frequency (315/433 MHz)",
      "2. Use SDR to capture key fob transmission",
      "3. Analyze signal pattern and extract code",
      "4. Store captured signal for replay",
      "5. Retransmit signal using HackRF/YardStick",
      "6. Verify vehicle response"
    ],
    legalStatus: "ILLEGAL without vehicle owner authorization"
  },
  {
    id: "rolling-code-relay",
    name: "Rolling Code Relay Attack",
    type: "relay",
    targetSystem: "pke",
    frequency: "125 kHz LF / 315-433 MHz UHF",
    description: "Relay signals between key fob and vehicle to extend range and bypass proximity requirements",
    difficulty: "Medium",
    equipment: [
      "Two SDRs (one near key, one near car)",
      "Amplifiers for 125 kHz LF and UHF",
      "Microcontrollers for signal relay",
      "Proxmark3 (optional for analysis)"
    ],
    vulnerableYears: "2000-present (affects most modern keyless systems)",
    mitigations: [
      "Motion sensors in key fob",
      "Ultra-wideband (UWB) ranging",
      "Time-of-flight measurements",
      "Faraday pouch for key storage",
      "Enable sleep mode on key fob"
    ],
    procedure: [
      "1. Position relay device #1 near target key fob (inside home)",
      "2. Position relay device #2 near vehicle",
      "3. Capture 125 kHz LF wake-up signal from car",
      "4. Relay to key fob to trigger response",
      "5. Capture UHF response from key fob",
      "6. Relay back to vehicle in real-time",
      "7. Vehicle unlocks/starts believing key is present"
    ],
    legalStatus: "ILLEGAL - Federal offense under CFAA"
  },
  {
    id: "rolljam-attack",
    name: "RollJam Code Capture",
    type: "code_grabbing",
    targetSystem: "keyfob",
    frequency: "315 MHz / 433 MHz",
    description: "Jam and capture rolling codes, then replay to gain access after owner locks car",
    difficulty: "Hard",
    equipment: [
      "RollJam device (custom or commercial)",
      "HackRF One with full-duplex capability",
      "Two transmitters for jamming",
      "High-gain antennas"
    ],
    vulnerableYears: "1995-2018 (many vehicles still vulnerable)",
    mitigations: [
      "Implement code validation windows",
      "Detect jamming attempts",
      "Use bidirectional authentication",
      "Encrypted rolling codes",
      "Anomaly detection in receiver"
    ],
    procedure: [
      "1. Jam both 315 and 433 MHz frequencies when owner presses unlock",
      "2. Capture first rolling code (owner thinks it didn't work)",
      "3. Owner presses button again",
      "4. Jam again and capture second code",
      "5. Allow second code through to unlock car (owner satisfied)",
      "6. Attacker now has first code stored for later use",
      "7. Wait for owner to lock car and leave",
      "8. Replay first captured code to unlock"
    ],
    legalStatus: "ILLEGAL - Wiretapping and unauthorized access"
  },
  {
    id: "signal-amplification",
    name: "Signal Amplification Attack",
    type: "amplification",
    targetSystem: "pke",
    frequency: "125 kHz / 315-433 MHz",
    description: "Amplify low-frequency signals to extend range of passive keyless entry",
    difficulty: "Medium",
    equipment: [
      "125 kHz LF amplifier",
      "UHF receiver/transmitter",
      "Directional antennas",
      "Battery power supply"
    ],
    vulnerableYears: "2010-present (passive keyless entry systems)",
    mitigations: [
      "Distance bounding protocols",
      "RSSI (signal strength) validation",
      "Time-of-flight measurements",
      "Motion detection in key",
      "Two-factor unlock requirement"
    ],
    procedure: [
      "1. Position amplifier near building where key is located",
      "2. Amplify 125 kHz challenge signal from vehicle",
      "3. Key fob responds thinking it's near vehicle",
      "4. Amplify response back to vehicle",
      "5. Vehicle unlocks believing key is in proximity",
      "6. Can be used for theft or relay attack"
    ],
    legalStatus: "ILLEGAL without authorization"
  },
  {
    id: "tpms-spoofing",
    name: "TPMS Sensor Spoofing",
    type: "replay",
    targetSystem: "tpms",
    frequency: "315 MHz / 433 MHz",
    description: "Spoof tire pressure monitoring system sensors to trigger warnings or hide actual pressure",
    difficulty: "Easy",
    equipment: [
      "HackRF One or RTL-SDR",
      "Universal Radio Hacker (URH)",
      "TPMS analysis software"
    ],
    vulnerableYears: "2007-present (TREAD Act mandate)",
    mitigations: [
      "Encrypted TPMS signals",
      "Authentication codes",
      "Signal pattern validation",
      "Anomaly detection"
    ],
    procedure: [
      "1. Capture TPMS sensor transmissions (periodic broadcasts)",
      "2. Decode sensor ID and pressure data",
      "3. Craft spoofed packets with modified pressure values",
      "4. Transmit spoofed signals to vehicle",
      "5. Trigger false low/high pressure warnings",
      "6. Used for research on TPMS security"
    ],
    legalStatus: "Research/testing on own vehicle authorized"
  }
];

const HARDWARE_TOOLS = [
  {
    name: "HackRF One",
    frequency: "1 MHz - 6 GHz",
    txPower: "15 dBm",
    price: "$300-350",
    use: "Full-duplex SDR for TX/RX, ideal for replay/relay attacks"
  },
  {
    name: "RTL-SDR",
    frequency: "24 MHz - 1.7 GHz",
    txPower: "RX only",
    price: "$25-35",
    use: "Receive-only, good for signal analysis and capture"
  },
  {
    name: "YardStick One",
    frequency: "300-348 MHz, 391-464 MHz, 782-928 MHz",
    txPower: "10 dBm",
    price: "$100-120",
    use: "Sub-GHz transceiver for keyfob/TPMS research"
  },
  {
    name: "Proxmark3",
    frequency: "125 kHz LF / 13.56 MHz HF",
    txPower: "Varies",
    price: "$200-300",
    use: "RFID/NFC research, LF key fob analysis"
  },
  {
    name: "USRP B200/B210",
    frequency: "70 MHz - 6 GHz",
    txPower: "20 dBm",
    price: "$700-1200",
    use: "Professional SDR for advanced research"
  }
];

export default function RFSecurityResearch() {
  const [selectedAttack, setSelectedAttack] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(true);
  const [filterType, setFilterType] = useState<RFAttackType | "all">("all");

  const filteredAttacks = RF_ATTACKS.filter(attack =>
    filterType === "all" || attack.type === filterType
  );

  if (showWarning) {
    return (
      <div style={{
        width: '100%',
        minHeight: '100vh',
        padding: '20px',
        backgroundColor: '#1a1a2e',
        color: '#fff',
        fontFamily: 'Arial, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          maxWidth: '800px',
          padding: '50px',
          backgroundColor: '#16213e',
          borderRadius: '20px',
          border: '5px solid #ff3333'
        }}>
          <h1 style={{ fontSize: '2.5rem', color: '#ff3333', marginBottom: '30px', textAlign: 'center' }}>
            ⚠️ AUTHORIZATION REQUIRED
          </h1>

          <div style={{
            padding: '30px',
            backgroundColor: '#3d0f0f',
            borderRadius: '15px',
            marginBottom: '30px',
            lineHeight: '1.8',
            fontSize: '1.1rem'
          }}>
            <h3 style={{ color: '#ff6666', marginBottom: '20px' }}>Legal Requirements:</h3>
            <ul style={{ paddingLeft: '20px' }}>
              <li>Licensed automotive security professional</li>
              <li>NASTF certification or equivalent</li>
              <li>Written authorization to test target vehicles</li>
              <li>Academic/research institutional approval</li>
              <li>Compliance with CFAA and local laws</li>
            </ul>

            <p style={{ marginTop: '25px', fontWeight: 'bold', color: '#ff6666' }}>
              ⚖️ Unauthorized RF signal interception and vehicle access is a FEDERAL CRIME
              punishable by fines and imprisonment under 18 U.S.C. § 1030 (CFAA).
            </p>
          </div>

          <div style={{
            padding: '20px',
            backgroundColor: '#0f3460',
            borderRadius: '10px',
            marginBottom: '30px',
            fontSize: '0.95rem',
            lineHeight: '1.6'
          }}>
            <h3 style={{ color: '#00d4ff', marginBottom: '15px' }}>This Module Provides:</h3>
            <ul style={{ paddingLeft: '20px' }}>
              <li>Educational information on RF attack vectors</li>
              <li>Vulnerability research procedures</li>
              <li>Defensive countermeasures</li>
              <li>Hardware requirements for authorized testing</li>
            </ul>
          </div>

          <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
            <button
              onClick={() => setShowWarning(false)}
              style={{
                padding: '20px 40px',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                backgroundColor: '#00ff66',
                color: '#000',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer'
              }}
            >
              ✓ I Am Authorized - Proceed
            </button>

            <button
              onClick={() => window.history.back()}
              style={{
                padding: '20px 40px',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                backgroundColor: '#666',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                cursor: 'pointer'
              }}
            >
              ← Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      padding: '20px',
      backgroundColor: '#1a1a2e',
      color: '#fff',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px',
        backgroundColor: '#16213e',
        borderRadius: '20px'
      }}>
        <h1 style={{ fontSize: '2.5rem', color: '#ff6600', marginBottom: '10px' }}>
          📡 RF Security Research Lab
        </h1>
        <p style={{ color: '#aaa', marginBottom: '30px' }}>
          Automotive RF Replay & Relay Attack Research Platform
        </p>

        {/* Filter Buttons */}
        <div style={{ marginBottom: '30px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {(["all", "replay", "relay", "code_grabbing", "amplification", "jamming"] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              style={{
                padding: '10px 20px',
                fontSize: '1rem',
                backgroundColor: filterType === type ? '#ff6600' : '#0f3460',
                color: '#fff',
                border: `2px solid ${filterType === type ? '#ff6600' : '#666'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {type.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Attack Techniques */}
        <div style={{ marginBottom: '40px' }}>
          <h2 style={{ color: '#00d4ff', fontSize: '1.8rem', marginBottom: '20px' }}>
            Attack Vectors ({filteredAttacks.length})
          </h2>

          {filteredAttacks.map(attack => (
            <div
              key={attack.id}
              onClick={() => setSelectedAttack(selectedAttack === attack.id ? null : attack.id)}
              style={{
                padding: '25px',
                marginBottom: '15px',
                backgroundColor: '#0f3460',
                borderRadius: '10px',
                border: `3px solid ${
                  attack.difficulty === 'Easy' ? '#00ff66' :
                  attack.difficulty === 'Medium' ? '#ffaa00' :
                  attack.difficulty === 'Hard' ? '#ff6600' : '#ff3333'
                }`,
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                <div>
                  <h3 style={{ color: '#00d4ff', fontSize: '1.4rem', marginBottom: '5px' }}>
                    {attack.name}
                  </h3>
                  <div style={{ fontSize: '0.9rem', color: '#aaa' }}>
                    📡 {attack.frequency} | 🎯 {attack.targetSystem.toUpperCase()}
                  </div>
                </div>
                <div style={{
                  padding: '8px 15px',
                  backgroundColor: attack.difficulty === 'Easy' ? '#00ff6620' :
                                 attack.difficulty === 'Medium' ? '#ffaa0020' :
                                 attack.difficulty === 'Hard' ? '#ff660020' : '#ff333320',
                  color: attack.difficulty === 'Easy' ? '#00ff66' :
                        attack.difficulty === 'Medium' ? '#ffaa00' :
                        attack.difficulty === 'Hard' ? '#ff6600' : '#ff3333',
                  borderRadius: '5px',
                  fontWeight: 'bold',
                  fontSize: '0.9rem'
                }}>
                  {attack.difficulty}
                </div>
              </div>

              <p style={{ marginBottom: '15px', lineHeight: '1.6' }}>{attack.description}</p>

              {selectedAttack === attack.id && (
                <div style={{
                  marginTop: '25px',
                  paddingTop: '25px',
                  borderTop: '2px solid #666'
                }}>
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ color: '#ff6600', marginBottom: '10px' }}>🛠️ Required Equipment:</h4>
                    <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                      {attack.equipment.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ color: '#ff6600', marginBottom: '10px' }}>📋 Procedure:</h4>
                    <ol style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                      {attack.procedure.map((step, idx) => (
                        <li key={idx} style={{ marginBottom: '8px' }}>{step}</li>
                      ))}
                    </ol>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ color: '#00ff66', marginBottom: '10px' }}>🛡️ Mitigations:</h4>
                    <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                      {attack.mitigations.map((mit, idx) => (
                        <li key={idx}>{mit}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{
                    padding: '15px',
                    backgroundColor: '#3d0f0f',
                    borderRadius: '8px',
                    border: '2px solid #ff3333'
                  }}>
                    <strong style={{ color: '#ff6666' }}>⚖️ Legal Status:</strong> {attack.legalStatus}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Hardware Tools */}
        <div style={{
          padding: '30px',
          backgroundColor: '#0f3460',
          borderRadius: '10px',
          border: '2px solid #00d4ff',
          marginBottom: '20px'
        }}>
          <h3 style={{ color: '#00d4ff', fontSize: '1.5rem', marginBottom: '20px' }}>
            🔧 Research Hardware
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
            {HARDWARE_TOOLS.map((tool, idx) => (
              <div key={idx} style={{
                padding: '20px',
                backgroundColor: '#0f1f3d',
                borderRadius: '8px',
                border: '2px solid #9933ff'
              }}>
                <h4 style={{ color: '#9933ff', marginBottom: '10px' }}>{tool.name}</h4>
                <div style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                  <div><strong>Frequency:</strong> {tool.frequency}</div>
                  <div><strong>TX Power:</strong> {tool.txPower}</div>
                  <div><strong>Price:</strong> {tool.price}</div>
                  <div style={{ marginTop: '10px', color: '#aaa' }}>{tool.use}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
