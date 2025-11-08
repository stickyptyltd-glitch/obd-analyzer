import React, { useState } from "react";

/**
 * AUTEL ALL KEYS LOST (AKL) PROCEDURES
 *
 * PROFESSIONAL USE ONLY
 * Authorization required for use
 */

interface AKLProcedure {
  id: string;
  manufacturer: string;
  model: string;
  years: string;
  system: string;
  method: "OBD" | "Bench" | "Hybrid";
  difficulty: "Basic" | "Intermediate" | "Advanced" | "Expert";
  timeEstimate: string;
  equipment: string[];
  prerequisites: string[];
  steps: ProcedureStep[];
  pinExtraction?: string[];
  commonIssues: string[];
  successRate: string;
  notes: string[];
}

interface ProcedureStep {
  step: number;
  action: string;
  details?: string;
  warning?: string;
  image?: string;
}

const AKL_PROCEDURES: AKLProcedure[] = [
  {
    id: "vw-mqb-akl",
    manufacturer: "Volkswagen/Audi",
    model: "Golf, Jetta, Tiguan, Passat, A3, Q3 (MQB Platform)",
    years: "2013-2020",
    system: "MQB48 V850 IMMO",
    method: "OBD",
    difficulty: "Intermediate",
    timeEstimate: "45-90 minutes",
    equipment: [
      "Autel IM608/IM508",
      "XP400 programmer (recommended)",
      "APB112 for EEPROM backup (optional)",
      "OBD-II cable"
    ],
    prerequisites: [
      "Vehicle battery fully charged (>12.5V)",
      "All doors closed",
      "Ignition OFF",
      "Autel software updated to latest version",
      "Valid subscription active"
    ],
    steps: [
      {
        step: 1,
        action: "Connect Autel device to OBD-II port",
        details: "Ensure solid connection, check LED indicators"
      },
      {
        step: 2,
        action: "Navigate: IMMO > Volkswagen/Audi > MQB Platform",
        details: "Select correct model year and engine type"
      },
      {
        step: 3,
        action: "Select 'All Keys Lost' function",
        details: "System will perform initial diagnostics"
      },
      {
        step: 4,
        action: "Read IMMO data from ECU",
        details: "This extracts CS (Component Security) data",
        warning: "Do NOT interrupt this process"
      },
      {
        step: 5,
        action: "Calculate dealer key using online calculation",
        details: "Autel connects to server for key calculation (requires internet)"
      },
      {
        step: 6,
        action: "Write dealer key to IMMO system",
        details: "System writes authorization data to BCM/Gateway"
      },
      {
        step: 7,
        action: "Program new smart key",
        details: "Place blank key in XP400 programmer, follow prompts",
        warning: "Use only genuine VW/Audi 434MHz smart keys"
      },
      {
        step: 8,
        action: "Learn key to vehicle via OBD",
        details: "Follow on-screen prompts for key learning"
      },
      {
        step: 9,
        action: "Test key functionality",
        details: "Verify unlock, lock, trunk, panic, start functions"
      }
    ],
    pinExtraction: [
      "PIN not required for MQB AKL via Autel",
      "Online calculation replaces PIN requirement",
      "CS data extracted automatically from ECU"
    ],
    commonIssues: [
      "Gateway offline - check battery voltage",
      "Communication error - clean OBD port, check fuses",
      "Key not learned - ensure KESSY module is responsive",
      "Calculation failed - verify VIN matches vehicle, check subscription",
      "Partial programming - restart procedure from step 1"
    ],
    successRate: "95%+",
    notes: [
      "2019+ models may require dealer intervention for certain variants",
      "Backup EEPROM before attempting on modified vehicles",
      "Some MY2020 vehicles use MQB Evo platform - different procedure",
      "Convertible/Cabrio models may need roof position calibration after"
    ]
  },
  {
    id: "gm-2015-2024-akl",
    manufacturer: "GM (Chevrolet/GMC/Cadillac)",
    model: "Silverado, Tahoe, Suburban, Camaro, Corvette, Malibu",
    years: "2015-2024",
    system: "BCM2/RFA Programming",
    method: "OBD",
    difficulty: "Intermediate",
    timeEstimate: "30-60 minutes",
    equipment: [
      "Autel IM608/IM508",
      "XP200/XP400 programmer",
      "12V power supply (battery maintainer recommended)",
      "OBD-II cable"
    ],
    prerequisites: [
      "Battery voltage >12V maintained throughout",
      "All modules online (no critical DTCs)",
      "Security access code (if required by year/model)",
      "Ignition OFF, all accessories OFF"
    ],
    steps: [
      {
        step: 1,
        action: "Connect power supply to battery",
        details: "Use maintainer to prevent voltage drop during programming",
        warning: "Low voltage during BCM programming can brick module"
      },
      {
        step: 2,
        action: "Connect Autel to OBD port",
        details: "Verify communication with BCM and RFA modules"
      },
      {
        step: 3,
        action: "Navigate: IMMO > GM > Year > Model",
        details: "Select exact vehicle configuration"
      },
      {
        step: 4,
        action: "Select 'All Keys Lost' or 'Program Smart Key'",
        details: "For 2021+ may require 'Add Key' then delete old keys"
      },
      {
        step: 5,
        action: "Enter security access (if prompted)",
        details: "Some models require 4-digit code from owner or dealer",
        warning: "Incorrect codes may lock module"
      },
      {
        step: 6,
        action: "Read BCM data and generate new key code",
        details: "Autel extracts BCM parameters and calculates key data"
      },
      {
        step: 7,
        action: "Program transponder using XP200/XP400",
        details: "Insert blank GM transponder, follow programming steps"
      },
      {
        step: 8,
        action: "Program remote using Autel",
        details: "Follow prompts to learn remote functions (may require button presses)"
      },
      {
        step: 9,
        action: "Write key data to BCM",
        details: "This authorizes new key in vehicle system"
      },
      {
        step: 10,
        action: "Test all functions",
        details: "Unlock, lock, remote start (if equipped), engine start"
      }
    ],
    commonIssues: [
      "BCM offline after programming - cycle ignition, wait 2 mins",
      "Key starts then dies - transponder not properly programmed",
      "Remote doesn't work - reprogram remote separately",
      "Security lockout - wait 10 minutes, retry with correct code",
      "2021+ models more restrictive - may need dealer assist"
    ],
    successRate: "90% (2015-2020), 75% (2021-2024)",
    notes: [
      "C8 Corvette (2020+) uses different system - limited Autel support",
      "Vehicles with aftermarket alarm may interfere",
      "Some 2023+ models require online authentication",
      "Always verify key type before programming (5/6 button variations)"
    ]
  },
  {
    id: "bmw-cas3-akl",
    manufacturer: "BMW",
    model: "3/5/7 Series, X3/X5 (E-chassis)",
    years: "2006-2013",
    system: "CAS3/CAS3+",
    method: "Hybrid",
    difficulty: "Advanced",
    timeEstimate: "90-180 minutes",
    equipment: [
      "Autel IM608 (IM508 limited support)",
      "APB112 for on-bench work",
      "CAS3 adapter cables",
      "BMW key programmer (XP400)",
      "Soldering equipment (if EEPROM needs direct access)"
    ],
    prerequisites: [
      "CAS module must be functional",
      "DME/DDE engine ECU accessible",
      "Battery maintainer required",
      "Backup EEPROM data before starting",
      "ISN (Individual Security Number) extraction completed"
    ],
    steps: [
      {
        step: 1,
        action: "Extract ISN from DME/DDE",
        details: "Connect to engine ECU via OBD, read ISN data",
        warning: "Some DME variants require bench read"
      },
      {
        step: 2,
        action: "Read CAS3 EEPROM data",
        details: "Can be done via OBD (CAS3) or bench (CAS3+)",
        warning: "CAS3+ often requires removal and bench programming"
      },
      {
        step: 3,
        action: "Calculate key data using ISN",
        details: "Autel performs calculation with ISN and CAS data"
      },
      {
        step: 4,
        action: "Generate new key profile",
        details: "Create key slot in CAS memory"
      },
      {
        step: 5,
        action: "Program BMW transponder",
        details: "Use XP400 to program blank BMW key (HUF5661/PCF7945)",
        warning: "Must use correct transponder type for vehicle year"
      },
      {
        step: 6,
        action: "Write updated CAS data",
        details: "Write new key authorization to CAS module",
        warning: "Do not disconnect during write process"
      },
      {
        step: 7,
        action: "Synchronize CAS with DME",
        details: "Perform ISN sync to match CAS and engine ECU"
      },
      {
        step: 8,
        action: "Program remote functions",
        details: "Learn key fob buttons for lock/unlock/trunk"
      },
      {
        step: 9,
        action: "Test start function",
        details: "Verify engine starts and runs normally"
      },
      {
        step: 10,
        action: "Clear adaptations and test drive",
        details: "Reset steering lock, test all security functions"
      }
    ],
    pinExtraction: [
      "ISN extraction is critical - equivalent to PIN",
      "Can be read from DME via OBD on most models",
      "MSV80/MSD81 may require bench read",
      "N54/N55 engines generally OBD accessible",
      "Backup ISN before any work - cannot recover if lost"
    ],
    commonIssues: [
      "ELV (steering lock) fault - may need replacement",
      "CAS tamper detection - requires virgin CAS or workaround",
      "ISN read failure - DME may be locked, need bench",
      "Key programmed but no start - ISN sync failed",
      "CAS3+ write failure - requires bench programming"
    ],
    successRate: "85% (OBD), 95% (Bench)",
    notes: [
      "F-series (2012+) uses CAS4 - different procedure",
      "Some CAS3+ absolutely require bench - OBD fails",
      "Aftermarket DME tuning may complicate ISN read",
      "Always order correct key blank - HU92 vs HU58 blade"
    ]
  }
];

export default function AutelAKLProcedures() {
  const [selectedProcedure, setSelectedProcedure] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const procedure = selectedProcedure ? AKL_PROCEDURES.find(p => p.id === selectedProcedure) : null;

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
          🔑 Autel All Keys Lost Procedures
        </h1>
        <p style={{ color: '#aaa', marginBottom: '30px' }}>
          Step-by-step AKL programming guidance for authorized professionals
        </p>

        {!selectedProcedure ? (
          <div>
            <h2 style={{ color: '#00d4ff', fontSize: '1.8rem', marginBottom: '20px' }}>
              Select Vehicle Manufacturer
            </h2>

            {AKL_PROCEDURES.map(proc => (
              <div
                key={proc.id}
                onClick={() => setSelectedProcedure(proc.id)}
                style={{
                  padding: '25px',
                  marginBottom: '15px',
                  backgroundColor: '#0f3460',
                  borderRadius: '10px',
                  border: `3px solid ${
                    proc.difficulty === 'Basic' ? '#00ff66' :
                    proc.difficulty === 'Intermediate' ? '#ffaa00' :
                    proc.difficulty === 'Advanced' ? '#ff6600' : '#ff3333'
                  }`,
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <h3 style={{ color: '#00d4ff', fontSize: '1.4rem', marginBottom: '5px' }}>
                      {proc.manufacturer}
                    </h3>
                    <div style={{ fontSize: '0.95rem', color: '#aaa', marginBottom: '5px' }}>
                      {proc.model}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#888' }}>
                      {proc.years} | {proc.system} | {proc.method} | ⏱️ {proc.timeEstimate}
                    </div>
                  </div>
                  <div style={{
                    padding: '8px 15px',
                    backgroundColor: proc.difficulty === 'Basic' ? '#00ff6620' :
                                   proc.difficulty === 'Intermediate' ? '#ffaa0020' :
                                   proc.difficulty === 'Advanced' ? '#ff660020' : '#ff333320',
                    color: proc.difficulty === 'Basic' ? '#00ff66' :
                          proc.difficulty === 'Intermediate' ? '#ffaa00' :
                          proc.difficulty === 'Advanced' ? '#ff6600' : '#ff3333',
                    borderRadius: '5px',
                    fontWeight: 'bold'
                  }}>
                    {proc.difficulty}
                  </div>
                </div>
                <div style={{ marginTop: '15px', color: '#0ff' }}>
                  Success Rate: {proc.successRate}
                </div>
              </div>
            ))}
          </div>
        ) : procedure ? (
          <div>
            <button
              onClick={() => setSelectedProcedure(null)}
              style={{
                padding: '10px 20px',
                marginBottom: '20px',
                fontSize: '1rem',
                backgroundColor: '#666',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              ← Back to List
            </button>

            <h2 style={{ color: '#00d4ff', fontSize: '2rem', marginBottom: '20px' }}>
              {procedure.manufacturer} - {procedure.model}
            </h2>

            {/* Equipment */}
            <div style={{
              padding: '20px',
              marginBottom: '20px',
              backgroundColor: '#0f3460',
              borderRadius: '10px',
              border: '2px solid #00d4ff'
            }}>
              <h3 style={{ color: '#00d4ff', marginBottom: '15px' }}>🛠️ Required Equipment</h3>
              <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                {procedure.equipment.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            {/* Prerequisites */}
            <div style={{
              padding: '20px',
              marginBottom: '20px',
              backgroundColor: '#3d2e0f',
              borderRadius: '10px',
              border: '2px solid #ffaa00'
            }}>
              <h3 style={{ color: '#ffaa00', marginBottom: '15px' }}>⚠️ Prerequisites</h3>
              <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                {procedure.prerequisites.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            {/* Steps */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ color: '#00ff66', fontSize: '1.5rem', marginBottom: '15px' }}>
                📋 Procedure Steps
              </h3>

              {procedure.steps.map((step, idx) => (
                <div
                  key={idx}
                  style={{
                    marginBottom: '10px',
                    padding: '20px',
                    backgroundColor: '#0f3460',
                    borderRadius: '10px',
                    border: '2px solid #9933ff',
                    cursor: 'pointer'
                  }}
                  onClick={() => setExpandedStep(expandedStep === step.step ? null : step.step)}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#00d4ff' }}>
                    Step {step.step}: {step.action}
                  </div>

                  {expandedStep === step.step && (
                    <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #666' }}>
                      {step.details && (
                        <div style={{ marginBottom: '10px', color: '#ccc' }}>
                          💡 {step.details}
                        </div>
                      )}
                      {step.warning && (
                        <div style={{
                          padding: '10px',
                          backgroundColor: '#3d0f0f',
                          borderRadius: '5px',
                          border: '2px solid #ff3333',
                          color: '#ff6666'
                        }}>
                          ⚠️ <strong>WARNING:</strong> {step.warning}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Common Issues */}
            <div style={{
              padding: '20px',
              marginBottom: '20px',
              backgroundColor: '#3d0f0f',
              borderRadius: '10px',
              border: '2px solid #ff6600'
            }}>
              <h3 style={{ color: '#ff6600', marginBottom: '15px' }}>🔧 Common Issues & Solutions</h3>
              <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                {procedure.commonIssues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            </div>

            {/* Notes */}
            <div style={{
              padding: '20px',
              backgroundColor: '#0f1f3d',
              borderRadius: '10px',
              border: '2px solid #9933ff'
            }}>
              <h3 style={{ color: '#9933ff', marginBottom: '15px' }}>📝 Important Notes</h3>
              <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                {procedure.notes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
