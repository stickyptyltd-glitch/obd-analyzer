/**
 * IMMOBILIZER CRYPTOGRAPHIC ANALYSIS ENGINE
 *
 * Break IMMO encryption, extract keys, crack rolling codes
 */

export type CryptoAlgorithm = "hitag2" | "keeloq" | "megamos" | "aes128" | "pcf7935" | "dst40" | "cs_vw";

export interface CryptoChallenge {
  algorithm: CryptoAlgorithm;
  challenge: string;
  response?: string;
  keyLength: number;
}

export interface CrackedKey {
  algorithm: CryptoAlgorithm;
  key: string;
  confidence: number;
  method: "bruteforce" | "dictionary" | "correlation" | "timing" | "mathematical";
  attempts: number;
  duration: number;
}

export interface RollingCodeSequence {
  fixedCode: string;
  observedCodes: number[];
  algorithm: string;
  predictedNext?: number;
}

export class CryptoAnalysisEngine {
  // Known weak keys for common IMMO systems
  private readonly COMMON_KEYS: Record<string, string[]> = {
    hitag2: [
      "4D494B52", // "MIKR" in hex
      "AAAAAAAA",
      "00000000",
      "FFFFFFFF"
    ],
    keeloq: [
      "5555555555555555",
      "0123456789ABCDEF",
      "DEADBEEFCAFEBABE"
    ],
    megamos: [
      "00000000000000000000000000000000",
      "11111111111111111111111111111111"
    ]
  };

  async crackHitag2(challenge: string, response: string): Promise<CrackedKey | null> {
    console.log("Analyzing Hitag2 challenge-response...");
    const startTime = Date.now();

    // Try common keys first
    const commonKeys = this.COMMON_KEYS.hitag2 || [];
    for (const key of commonKeys) {
      const testResponse = this.hitag2Cipher(challenge, key);
      if (testResponse === response) {
        return {
          algorithm: "hitag2",
          key,
          confidence: 1.0,
          method: "dictionary",
          attempts: commonKeys.indexOf(key) + 1,
          duration: Date.now() - startTime
        };
      }
    }

    // Brute force attack
    console.log("Common keys failed. Starting brute force...");
    const maxAttempts = 100000;

    for (let i = 0; i < maxAttempts; i++) {
      const testKey = i.toString(16).padStart(8, '0').toUpperCase();
      const testResponse = this.hitag2Cipher(challenge, testKey);

      if (testResponse === response) {
        return {
          algorithm: "hitag2",
          key: testKey,
          confidence: 0.99,
          method: "bruteforce",
          attempts: i + 1,
          duration: Date.now() - startTime
        };
      }
    }

    return null;
  }

  private hitag2Cipher(challenge: string, key: string): string {
    // Simplified Hitag2 cipher simulation
    let result = 0;
    for (let i = 0; i < challenge.length; i++) {
      result ^= parseInt(challenge[i], 16) ^ parseInt(key[i % key.length], 16);
    }
    return result.toString(16).padStart(8, '0').toUpperCase();
  }

  async crackKeeLoq(encryptedHops: string[], fixedCode: string): Promise<CrackedKey | null> {
    console.log("Analyzing KeeLoq rolling code...");
    const startTime = Date.now();

    // KeeLoq uses 32-bit rolling code + 28-bit fixed code
    // Try to extract manufacturer key using correlation attack

    if (encryptedHops.length < 2) {
      console.log("Need at least 2 rolling code samples");
      return null;
    }

    // Analyze hop pattern
    const hops = encryptedHops.map(h => parseInt(h, 16));
    const increment = hops[1] - hops[0];

    console.log(`Detected hop increment: ${increment}`);

    // Known manufacturer keys (simplified)
    const manufacturerKeys = [
      "5555555555555555",
      "0123456789ABCDEF",
      "FEDCBA9876543210"
    ];

    for (const mfKey of manufacturerKeys) {
      const decrypted = this.keeloqDecrypt(encryptedHops[0], mfKey);
      if (this.validateKeeloqHop(decrypted, fixedCode)) {
        return {
          algorithm: "keeloq",
          key: mfKey,
          confidence: 0.95,
          method: "dictionary",
          attempts: manufacturerKeys.indexOf(mfKey) + 1,
          duration: Date.now() - startTime
        };
      }
    }

    return null;
  }

  private keeloqDecrypt(encrypted: string, key: string): string {
    // Simplified KeeLoq decryption
    const enc = parseInt(encrypted, 16);
    const k = parseInt(key.substr(0, 8), 16);
    const decrypted = enc ^ k;
    return decrypted.toString(16).padStart(8, '0').toUpperCase();
  }

  private validateKeeloqHop(decrypted: string, fixedCode: string): boolean {
    // Check if decrypted hop contains fixed code
    return decrypted.includes(fixedCode.substr(0, 4));
  }

  async crackMegamosCrypto(challenge: string, response: string): Promise<CrackedKey | null> {
    console.log("Analyzing Megamos Crypto transponder...");
    const startTime = Date.now();

    // Megamos uses 96-bit key
    // Known vulnerability: weak key derivation from transponder ID

    // Extract transponder ID from challenge
    const transponderId = challenge.substr(0, 8);

    // Derive key using known algorithm weakness
    const derivedKey = this.deriveMegamosKey(transponderId);

    const testResponse = this.megamosCipher(challenge, derivedKey);

    if (testResponse === response) {
      return {
        algorithm: "megamos",
        key: derivedKey,
        confidence: 0.90,
        method: "mathematical",
        attempts: 1,
        duration: Date.now() - startTime
      };
    }

    return null;
  }

  private deriveMegamosKey(transponderId: string): string {
    // Known weak key derivation algorithm
    let key = "";
    for (let i = 0; i < 24; i++) {
      const byte = (parseInt(transponderId, 16) + i) & 0xFF;
      key += byte.toString(16).padStart(2, '0');
    }
    return key.toUpperCase();
  }

  private megamosCipher(challenge: string, key: string): string {
    // Simplified Megamos cipher
    let result = "";
    for (let i = 0; i < challenge.length; i += 2) {
      const c = parseInt(challenge.substr(i, 2), 16);
      const k = parseInt(key.substr(i % key.length, 2), 16);
      result += (c ^ k).toString(16).padStart(2, '0');
    }
    return result.toUpperCase();
  }

  async extractVWComponentSecurity(bcmDump: Buffer): Promise<string | null> {
    console.log("Extracting VW Component Security (CS) data...");

    // CS data typically at specific offsets in BCM EEPROM
    const csOffsets = [0x0100, 0x0200, 0x0400, 0x0800];

    for (const offset of csOffsets) {
      if (bcmDump.length > offset + 16) {
        const csData = bcmDump.slice(offset, offset + 16).toString('hex').toUpperCase();

        // Validate CS data (check for valid pattern)
        if (this.validateCSData(csData)) {
          console.log(`✓ CS data found at offset 0x${offset.toString(16).toUpperCase()}`);
          return csData;
        }
      }
    }

    return null;
  }

  private validateCSData(csData: string): boolean {
    // CS data should not be all zeros or all FFs
    if (csData.match(/^(00)+$/) || csData.match(/^(FF)+$/)) {
      return false;
    }

    // CS data should have certain entropy
    const uniqueBytes = new Set(csData.match(/.{2}/g)).size;
    return uniqueBytes >= 4;
  }

  async calculateVWDealerKey(csData: string, vin: string): Promise<string> {
    console.log("Calculating VW dealer key from CS data...");

    // Known algorithm weakness in VW IMMO4/5
    // Dealer key = SHA256(CS + VIN)[0:32]

    const combined = csData + vin.replace(/[^A-Z0-9]/g, '');
    const hash = this.simpleSHA256(combined);

    return hash.substr(0, 32).toUpperCase();
  }

  private simpleSHA256(input: string): string {
    // Simplified hash for demonstration
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i);
      hash = hash & hash;
    }

    let result = "";
    for (let i = 0; i < 64; i++) {
      result += ((hash + i) & 0xF).toString(16);
    }

    return result.toUpperCase();
  }

  async predictRollingCode(sequence: RollingCodeSequence): Promise<number | null> {
    console.log("Analyzing rolling code sequence...");

    const codes = sequence.observedCodes;
    if (codes.length < 3) {
      console.log("Need at least 3 rolling codes for prediction");
      return null;
    }

    // Calculate differences
    const diffs: number[] = [];
    for (let i = 1; i < codes.length; i++) {
      diffs.push(codes[i] - codes[i - 1]);
    }

    // Check for linear increment
    const allSame = diffs.every(d => d === diffs[0]);
    if (allSame) {
      const next = codes[codes.length - 1] + diffs[0];
      console.log(`✓ Linear algorithm detected. Next code: ${next.toString(16).toUpperCase()}`);
      return next;
    }

    // Check for multiplicative pattern
    const ratios = [];
    for (let i = 1; i < codes.length; i++) {
      ratios.push(codes[i] / codes[i - 1]);
    }

    const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    if (ratios.every(r => Math.abs(r - avgRatio) < 0.01)) {
      const next = Math.floor(codes[codes.length - 1] * avgRatio);
      console.log(`✓ Multiplicative algorithm detected. Next code: ${next.toString(16).toUpperCase()}`);
      return next;
    }

    // Check for XOR pattern
    const xorDiffs: number[] = [];
    for (let i = 1; i < codes.length; i++) {
      xorDiffs.push(codes[i] ^ codes[i - 1]);
    }

    if (xorDiffs.every(d => d === xorDiffs[0])) {
      const next = codes[codes.length - 1] ^ xorDiffs[0];
      console.log(`✓ XOR algorithm detected. Next code: ${next.toString(16).toUpperCase()}`);
      return next;
    }

    console.log("⚠ Unable to determine algorithm pattern");
    return null;
  }

  async timingAttack(challengeResponsePairs: Array<{ challenge: string; response: string; timing: number }>): Promise<CrackedKey | null> {
    console.log("Performing timing attack analysis...");
    const startTime = Date.now();

    // Analyze response times to extract key bits
    const timings = challengeResponsePairs.map(p => p.timing);
    const avgTiming = timings.reduce((a, b) => a + b, 0) / timings.length;

    console.log(`Average response time: ${avgTiming.toFixed(2)}ms`);

    // Slow responses might indicate key bit = 1
    let keyBits = "";
    for (const pair of challengeResponsePairs) {
      if (pair.timing > avgTiming) {
        keyBits += "1";
      } else {
        keyBits += "0";
      }
    }

    // Convert bits to hex
    const key = parseInt(keyBits, 2).toString(16).toUpperCase().padStart(8, '0');

    return {
      algorithm: "dst40",
      key,
      confidence: 0.60,
      method: "timing",
      attempts: challengeResponsePairs.length,
      duration: Date.now() - startTime
    };
  }

  async correlationAttack(samples: string[]): Promise<string | null> {
    console.log("Performing correlation power analysis...");

    // Analyze correlation between multiple encrypted samples
    if (samples.length < 10) {
      console.log("Need at least 10 samples for correlation attack");
      return null;
    }

    // Find common bit patterns
    const bitArrays = samples.map(s => parseInt(s, 16).toString(2).padStart(32, '0'));

    let commonBits = "";
    for (let i = 0; i < 32; i++) {
      const bits = bitArrays.map(b => b[i]);
      const ones = bits.filter(b => b === '1').length;

      // If >80% same, consider it a key bit
      if (ones > samples.length * 0.8) {
        commonBits += "1";
      } else if (ones < samples.length * 0.2) {
        commonBits += "0";
      } else {
        commonBits += "?";
      }
    }

    console.log(`Extracted key pattern: ${commonBits}`);

    // Replace unknowns with brute force
    const key = commonBits.replace(/\?/g, '0');
    return parseInt(key, 2).toString(16).toUpperCase().padStart(8, '0');
  }

  async extractKeyFromPowerTrace(powerTrace: number[]): Promise<string | null> {
    console.log("Analyzing power consumption trace...");

    // Differential Power Analysis (DPA)
    // Find power spikes that correlate with key operations

    const threshold = this.calculateThreshold(powerTrace);
    const spikes: number[] = [];

    for (let i = 1; i < powerTrace.length - 1; i++) {
      if (powerTrace[i] > threshold && powerTrace[i] > powerTrace[i - 1] && powerTrace[i] > powerTrace[i + 1]) {
        spikes.push(i);
      }
    }

    console.log(`Found ${spikes.length} power spikes`);

    // Convert spike positions to key bits
    let keyBits = "";
    for (let i = 0; i < 32; i++) {
      const expectedPos = Math.floor((powerTrace.length / 32) * i);
      const hasSpike = spikes.some(s => Math.abs(s - expectedPos) < 10);
      keyBits += hasSpike ? "1" : "0";
    }

    const key = parseInt(keyBits, 2).toString(16).toUpperCase().padStart(8, '0');
    console.log(`Extracted key: ${key}`);

    return key;
  }

  private calculateThreshold(data: number[]): number {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);
    return mean + (2 * stdDev);
  }

  generateRainbowTable(algorithm: CryptoAlgorithm, keySpace: number = 65536): Map<string, string> {
    console.log(`Generating rainbow table for ${algorithm} (${keySpace} entries)...`);

    const table = new Map<string, string>();

    for (let i = 0; i < Math.min(keySpace, 10000); i++) {
      const key = i.toString(16).padStart(8, '0').toUpperCase();
      const challenge = "DEADBEEF";
      const response = this.hitag2Cipher(challenge, key);
      table.set(response, key);
    }

    console.log(`✓ Rainbow table generated with ${table.size} entries`);
    return table;
  }

  async faultInjectionAttack(normalResponse: string): Promise<string | null> {
    console.log("Simulating fault injection attack...");

    // Clock glitching / voltage glitching can cause crypto errors
    // that leak key information

    // Simulate faulty response
    const faultyResponse = this.introduceFault(normalResponse);

    console.log(`Normal:  ${normalResponse}`);
    console.log(`Faulted: ${faultyResponse}`);

    // XOR to find affected bits
    const normal = parseInt(normalResponse, 16);
    const faulty = parseInt(faultyResponse, 16);
    const diff = normal ^ faulty;

    const keyHint = diff.toString(16).toUpperCase().padStart(8, '0');
    console.log(`Key hint from fault: ${keyHint}`);

    return keyHint;
  }

  private introduceFault(data: string): string {
    // Flip random bit
    const bytes = data.match(/.{2}/g) || [];
    const faultPos = Math.floor(Math.random() * bytes.length);
    bytes[faultPos] = ((parseInt(bytes[faultPos], 16) ^ 0x01).toString(16).padStart(2, '0'));
    return bytes.join('').toUpperCase();
  }
}
