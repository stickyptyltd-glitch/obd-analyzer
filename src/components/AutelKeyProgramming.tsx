import React, { useState } from "react";

/**
 * AUTEL IMMO & KEY PROGRAMMING REFERENCE
 *
 * This module provides educational information about Autel's IMMO and key programming
 * capabilities. These functions are available on professional tools like:
 * - Autel IM508/IM508S
 * - Autel IM608/IM608 Pro II
 * - Autel MaxiIM Series
 *
 * AUTHORIZATION REQUIREMENTS:
 * - NASTF (National Automotive Service Task Force) certification
 * - State locksmith license (where applicable)
 * - Business insurance and proof of legitimate use
 * - Active Autel subscription
 *
 * LEGAL NOTICE:
 * Vehicle security bypass functions must only be used by authorized professionals
 * for legitimate purposes (locksmith services, vehicle recovery, authorized repairs).
 */

type IMMOFunction = {
  id: string;
  manufacturer: string;
  function: string;
  models: string;
  years: string;
  method: string;
  restrictions: string;
  status: "Active" | "Restricted" | "Removed";
  notes: string;
};

const AUTEL_FUNCTIONS: IMMOFunction[] = [
  {
    id: "ford-akl",
    manufacturer: "Ford",
    function: "All Keys Lost (AKL)",
    models: "F-Series, Mustang, Explorer, Edge, Escape, Focus",
    years: "2013-2024",
    method: "OBD programming with BCM access",
    restrictions: "REMOVED August 2025 - Ford forced Autel to remove IMMO functions",
    status: "Removed",
    notes: "Alternative: Use dealer-level tools or Xhorse/OBDSTAR equipment"
  },
  {
    id: "toyota-akl",
    manufacturer: "Toyota/Lexus",
    function: "All Keys Lost (AKL)",
    models: "Camry, Corolla, RAV4, Highlander, Tacoma, Tundra",
    years: "2010-2023",
    method: "OBD programming via IMMO module",
    restrictions: "RESTRICTED - Add key only (requires at least one working key)",
    status: "Restricted",
    notes: "Full AKL removed. Use Lonsdor K518 or dealer tools for full AKL"
  },
  {
    id: "vw-mqb-akl",
    manufacturer: "Volkswagen/Audi",
    function: "MQB48 All Keys Lost",
    models: "Golf, Jetta, Tiguan, Passat, A3, Q3",
    years: "2013-2020",
    method: "OBD with V850 EEPROM access",
    restrictions: "Active - Requires PIN code extraction",
    status: "Active",
    notes: "Works on MQB platform. Requires XP400 or APB112 for EEPROM backup"
  },
  {
    id: "gm-akl",
    manufacturer: "GM (Chevrolet/GMC/Cadillac)",
    function: "All Keys Lost",
    models: "Silverado, Tahoe, Suburban, Camaro, Corvette, Malibu",
    years: "2015-2024",
    method: "OBD with BCM programming",
    restrictions: "Active - May require security access code",
    status: "Active",
    notes: "BCM must be online. Some models require on-bench programming"
  },
  {
    id: "bmw-cas-akl",
    manufacturer: "BMW",
    function: "CAS All Keys Lost",
    models: "3/5/7 Series, X3/X5",
    years: "2006-2017",
    method: "OBD or on-bench CAS programming",
    restrictions: "Active - CAS3/CAS3+ supported via OBD, CAS4 requires bench",
    status: "Active",
    notes: "F-series (2012+) may require dealer authorization"
  },
  {
    id: "mercedes-akl",
    manufacturer: "Mercedes-Benz",
    function: "All Keys Lost",
    models: "C/E/S Class, GLC, GLE",
    years: "2000-2019",
    method: "OBD with EIS/EZS programming",
    restrictions: "Active - Requires IR key for newer models",
    status: "Active",
    notes: "W204/W212 fully supported. W205/W213 may need dealer intervention"
  },
  {
    id: "honda-akl",
    manufacturer: "Honda/Acura",
    function: "All Keys Lost",
    models: "Accord, Civic, CR-V, Pilot, Odyssey",
    years: "2013-2023",
    method: "OBD with IMMO/BCM programming",
    restrictions: "Active - 2017+ smart key systems more complex",
    status: "Active",
    notes: "Push-button start models require key presence simulation"
  },
  {
    id: "nissan-akl",
    manufacturer: "Nissan/Infiniti",
    function: "All Keys Lost",
    models: "Altima, Rogue, Pathfinder, Sentra, Maxima",
    years: "2013-2023",
    method: "OBD with BCM/NATS programming",
    restrictions: "Active - Intelligent Key systems fully supported",
    status: "Active",
    notes: "NATS 5/6 systems work well. May need PIN extraction"
  },
  {
    id: "chrysler-akl",
    manufacturer: "Chrysler/Dodge/Jeep/Ram",
    function: "All Keys Lost",
    models: "Ram 1500, Charger, Challenger, Durango, Grand Cherokee",
    years: "2011-2024",
    method: "OBD with RFH/SKREEM/WCM programming",
    restrictions: "Active - PIN code bypass available",
    status: "Active",
    notes: "ProximitySmart systems fully supported"
  },
  {
    id: "hyundai-kia-akl",
    manufacturer: "Hyundai/Kia",
    function: "All Keys Lost",
    models: "Sonata, Elantra, Santa Fe, Sorento, Sportage",
    years: "2013-2024",
    method: "OBD with SMARTRA programming",
    restrictions: "Active - Smart key systems fully supported",
    status: "Active",
    notes: "Recent theft vulnerability patched - use latest software"
  },
  {
    id: "subaru-akl",
    manufacturer: "Subaru",
    function: "All Keys Lost",
    models: "Outback, Forester, Crosstrek, Impreza, Legacy",
    years: "2010-2023",
    method: "OBD with IMMO/BCM programming",
    restrictions: "Active - 2020+ models more complex",
    status: "Active",
    notes: "May require PIN extraction from ECU"
  },
  {
    id: "mazda-akl",
    manufacturer: "Mazda",
    function: "All Keys Lost",
    models: "CX-5, CX-9, Mazda3, Mazda6",
    years: "2013-2023",
    method: "OBD with BCM programming (Ford-based)",
    restrictions: "Active - Similar to Ford systems",
    status: "Active",
    notes: "Uses Ford Smart Key architecture on many models"
  },
  {
    id: "volvo-akl",
    manufacturer: "Volvo",
    function: "All Keys Lost",
    models: "XC60, XC90, S60, S90, V60",
    years: "2010-2023",
    method: "OBD with CEM programming",
    restrictions: "Active - May require SPA/CMA platform tools",
    status: "Active",
    notes: "New SPA2 platform (2020+) more restrictive"
  },
  {
    id: "land-rover-akl",
    manufacturer: "Land Rover/Jaguar",
    function: "All Keys Lost",
    models: "Range Rover, Discovery, Evoque, F-PACE",
    years: "2010-2022",
    method: "OBD with KVM programming",
    restrictions: "Active - JLR tools required for 2019+",
    status: "Active",
    notes: "Newer models increasingly dealer-dependent"
  }
];

export default function AutelKeyProgramming() {
  const [selectedMfr, setSelectedMfr] = useState<string>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [showDetails, setShowDetails] = useState<string | null>(null);

  const manufacturers = ["All", ...new Set(AUTEL_FUNCTIONS.map(f => f.manufacturer.split('/')[0]))];

  const filteredFunctions = AUTEL_FUNCTIONS.filter(func => {
    const mfrMatch = selectedMfr === "All" || func.manufacturer.includes(selectedMfr);
    const searchMatch = searchTerm === "" ||
      func.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      func.models.toLowerCase().includes(searchTerm.toLowerCase()) ||
      func.function.toLowerCase().includes(searchTerm.toLowerCase());
    return mfrMatch && searchMatch;
  });

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
          🔐 Autel IMMO & Key Programming Reference
        </h1>

        <div style={{
          padding: '20px',
          backgroundColor: '#3d0f0f',
          borderRadius: '10px',
          border: '3px solid #ff3333',
          marginBottom: '30px',
          fontSize: '0.95rem',
          lineHeight: '1.6'
        }}>
          <h3 style={{ color: '#ff6666', marginBottom: '10px' }}>⚠️ AUTHORIZATION REQUIRED</h3>
          <p>Vehicle security bypass functions are <strong>restricted to authorized professionals only</strong>:</p>
          <ul style={{ paddingLeft: '20px', marginTop: '10px' }}>
            <li>NASTF certification required</li>
            <li>State locksmith license (where applicable)</li>
            <li>Business insurance and proof of legitimate use</li>
            <li>Active Autel subscription</li>
          </ul>
          <p style={{ marginTop: '10px', fontWeight: 'bold' }}>
            ⚖️ This information is for EDUCATIONAL PURPOSES ONLY. Unauthorized use of vehicle security bypass tools is illegal.
          </p>
        </div>

        {/* Search and Filter */}
        <div style={{ marginBottom: '30px' }}>
          <input
            type="text"
            placeholder="🔍 Search manufacturer or model..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '15px',
              fontSize: '1.1rem',
              backgroundColor: '#0f3460',
              color: '#fff',
              border: '2px solid #00d4ff',
              borderRadius: '10px',
              marginBottom: '15px'
            }}
          />

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {manufacturers.map(mfr => (
              <button
                key={mfr}
                onClick={() => setSelectedMfr(mfr)}
                style={{
                  padding: '10px 20px',
                  fontSize: '1rem',
                  backgroundColor: selectedMfr === mfr ? '#ff6600' : '#0f3460',
                  color: '#fff',
                  border: `2px solid ${selectedMfr === mfr ? '#ff6600' : '#666'}`,
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                {mfr}
              </button>
            ))}
          </div>
        </div>

        {/* Function List */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#00d4ff', fontSize: '1.5rem', marginBottom: '15px' }}>
            📋 Available Functions ({filteredFunctions.length})
          </h3>

          {filteredFunctions.map(func => (
            <div key={func.id} style={{
              padding: '20px',
              marginBottom: '15px',
              backgroundColor: '#0f3460',
              borderRadius: '10px',
              border: `3px solid ${func.status === 'Active' ? '#00ff66' : func.status === 'Restricted' ? '#ffaa00' : '#ff3333'}`,
              cursor: 'pointer'
            }}
            onClick={() => setShowDetails(showDetails === func.id ? null : func.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h4 style={{ color: '#00d4ff', fontSize: '1.3rem', marginBottom: '5px' }}>
                    {func.manufacturer} - {func.function}
                  </h4>
                  <div style={{ fontSize: '0.9rem', color: '#aaa' }}>
                    📅 {func.years} | 🚗 {func.models.split(',')[0]}...
                  </div>
                </div>
                <div style={{
                  padding: '5px 15px',
                  backgroundColor: func.status === 'Active' ? '#00ff6620' : func.status === 'Restricted' ? '#ffaa0020' : '#ff333320',
                  color: func.status === 'Active' ? '#00ff66' : func.status === 'Restricted' ? '#ffaa00' : '#ff3333',
                  borderRadius: '5px',
                  fontSize: '0.9rem',
                  fontWeight: 'bold'
                }}>
                  {func.status}
                </div>
              </div>

              {showDetails === func.id && (
                <div style={{
                  marginTop: '20px',
                  paddingTop: '20px',
                  borderTop: '2px solid #666',
                  fontSize: '0.95rem',
                  lineHeight: '1.8'
                }}>
                  <div style={{ marginBottom: '10px' }}>
                    <strong style={{ color: '#00d4ff' }}>Models:</strong> {func.models}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong style={{ color: '#00d4ff' }}>Method:</strong> {func.method}
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong style={{ color: '#00d4ff' }}>Restrictions:</strong> {func.restrictions}
                  </div>
                  <div style={{
                    padding: '15px',
                    backgroundColor: '#0f1f3d',
                    borderRadius: '8px',
                    border: '2px solid #9933ff',
                    marginTop: '15px'
                  }}>
                    <strong style={{ color: '#9933ff' }}>📝 Notes:</strong> {func.notes}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Educational Resources */}
        <div style={{
          padding: '30px',
          backgroundColor: '#0f3460',
          borderRadius: '10px',
          border: '2px solid #00d4ff',
          marginBottom: '20px'
        }}>
          <h3 style={{ color: '#00d4ff', fontSize: '1.5rem', marginBottom: '15px' }}>
            📚 Educational Resources
          </h3>
          <ul style={{ paddingLeft: '20px', lineHeight: '2' }}>
            <li><strong>Autel Official:</strong> autel.com - Product documentation and software updates</li>
            <li><strong>NASTF:</strong> nastf.org - Vehicle security professional certification</li>
            <li><strong>ALOA:</strong> aloa.org - Associated Locksmiths of America</li>
            <li><strong>Training:</strong> Advanced Diagnostics, Keyline, Silca offer IMMO training courses</li>
          </ul>
        </div>

        {/* Tool Requirements */}
        <div style={{
          padding: '30px',
          backgroundColor: '#1a0f3d',
          borderRadius: '10px',
          border: '2px solid #9933ff'
        }}>
          <h3 style={{ color: '#9933ff', fontSize: '1.5rem', marginBottom: '15px' }}>
            🛠️ Required Equipment
          </h3>
          <ul style={{ paddingLeft: '20px', lineHeight: '2' }}>
            <li><strong>Autel IM508/IM508S:</strong> Entry-level IMMO tool ($1,500-2,000)</li>
            <li><strong>Autel IM608/IM608 Pro II:</strong> Professional IMMO tool ($3,000-4,500)</li>
            <li><strong>XP400/XP200:</strong> Key programmer accessories</li>
            <li><strong>APB112 G-BOX:</strong> On-bench programming adapter</li>
            <li><strong>Software Subscription:</strong> $800-1,200/year for updates</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
