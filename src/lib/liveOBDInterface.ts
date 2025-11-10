/**
 * LIVE OBD-II COMMUNICATION INTERFACE
 *
 * Real-time vehicle communication via ELM327, STN1110, or direct CAN
 * NOW USES REAL BACKEND API
 */

import { RealAPI } from './api';

export type OBDAdapter = "elm327" | "stn1110" | "vlinker" | "obdlink" | "socketcan";
export type Protocol = "ISO15765-4" | "ISO14230-4" | "ISO9141-2" | "SAE-J1850-PWM" | "SAE-J1850-VPW";

export interface OBDConnection {
  adapter: OBDAdapter;
  protocol: Protocol;
  baudRate: number;
  port: string;
  connected: boolean;
  vehicleInfo?: VehicleInfo;
}

export interface VehicleInfo {
  vin: string;
  make: string;
  model: string;
  year: number;
  ecuCount: number;
  supportedPIDs: string[];
  protocols: Protocol[];
}

export interface LiveData {
  timestamp: number;
  pid: string;
  value: number;
  unit: string;
  formula?: string;
}

export class LiveOBDInterface {
  private connection: OBDConnection | null = null;
  private dataCallbacks: Map<string, (data: LiveData) => void> = new Map();
  private monitoringPIDs: Set<string> = new Set();
  private monitoringInterval: any = null;

  // Common OBD-II PIDs with descriptions
  private readonly PIDS = {
    "ENGINE_RPM": { pid: "010C", name: "Engine RPM", unit: "rpm" },
    "VEHICLE_SPEED": { pid: "010D", name: "Vehicle Speed", unit: "km/h" },
    "COOLANT_TEMP": { pid: "0105", name: "Coolant Temperature", unit: "°C" },
    "INTAKE_TEMP": { pid: "010F", name: "Intake Air Temperature", unit: "°C" },
    "MAF_RATE": { pid: "0110", name: "MAF Air Flow Rate", unit: "g/s" },
    "THROTTLE_POS": { pid: "0111", name: "Throttle Position", unit: "%" },
    "INTAKE_PRESSURE": { pid: "010B", name: "Intake Manifold Pressure", unit: "kPa" },
  };

  /**
   * Connect to OBD adapter via REAL backend
   */
  async connect(adapter: OBDAdapter, port: string = "/dev/rfcomm0"): Promise<boolean> {
    console.log(`Connecting to ${adapter} on ${port}...`);

    try {
      const baudRate = adapter === "elm327" ? 38400 : 115200;

      // Call REAL backend API
      const result = await RealAPI.obdConnect(port, baudRate);

      if (result.success) {
        this.connection = {
          adapter,
          protocol: "ISO15765-4",
          baudRate,
          port,
          connected: true
        };

        console.log("✅ Connected to OBD adapter");

        // Get vehicle info
        await this.getVehicleInfo();

        return true;
      } else {
        console.error("❌ Connection failed:", result.error);
        return false;
      }
    } catch (error) {
      console.error("❌ Connection error:", error);
      return false;
    }
  }

  /**
   * Get vehicle information
   */
  async getVehicleInfo(): Promise<VehicleInfo> {
    // For now, return simulated info
    // In future, can read VIN via PID 0902
    const info: VehicleInfo = {
      vin: "SIMULATED123456789",
      make: "Unknown",
      model: "Unknown",
      year: 2020,
      ecuCount: 1,
      supportedPIDs: Object.values(this.PIDS).map(p => p.pid),
      protocols: ["ISO15765-4"]
    };

    if (this.connection) {
      this.connection.vehicleInfo = info;
    }

    return info;
  }

  /**
   * Read PID from vehicle via REAL backend
   */
  async readPID(pid: string): Promise<LiveData | null> {
    if (!this.connection?.connected) {
      console.error("Not connected to OBD adapter");
      return null;
    }

    try {
      // Call REAL backend API
      const result = await RealAPI.obdReadPID(pid);

      if (result.success && result.value !== null) {
        const pidInfo = Object.values(this.PIDS).find(p => p.pid === pid);

        return {
          timestamp: Date.now(),
          pid: pidInfo?.name || pid,
          value: result.value,
          unit: pidInfo?.unit || "",
        };
      }

      return null;
    } catch (error) {
      console.error("Error reading PID:", error);
      return null;
    }
  }

  /**
   * Get DTCs from vehicle via REAL backend
   */
  async getDTCs(): Promise<string[]> {
    if (!this.connection?.connected) {
      console.error("Not connected to OBD adapter");
      return [];
    }

    try {
      // Call REAL backend API
      const result = await RealAPI.obdGetDTCs();

      if (result.success) {
        return result.dtcs || [];
      }

      return [];
    } catch (error) {
      console.error("Error reading DTCs:", error);
      return [];
    }
  }

  /**
   * Clear DTCs via REAL backend
   */
  async clearDTCs(): Promise<boolean> {
    if (!this.connection?.connected) {
      console.error("Not connected to OBD adapter");
      return false;
    }

    try {
      // Call REAL backend API
      const result = await RealAPI.obdClearDTCs();
      return result.success;
    } catch (error) {
      console.error("Error clearing DTCs:", error);
      return false;
    }
  }

  /**
   * Start monitoring PIDs
   */
  startMonitoring(pids: string[], interval: number = 200): void {
    if (!this.connection?.connected) {
      console.error("Not connected to OBD adapter");
      return;
    }

    this.monitoringPIDs = new Set(pids);

    // Clear existing interval
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Start monitoring loop
    this.monitoringInterval = setInterval(async () => {
      for (const pid of this.monitoringPIDs) {
        const data = await this.readPID(pid);

        if (data && this.dataCallbacks.has(pid)) {
          this.dataCallbacks.get(pid)!(data);
        }
      }
    }, interval);

    console.log(`Started monitoring ${pids.length} PIDs`);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.monitoringPIDs.clear();
    console.log("Stopped monitoring");
  }

  /**
   * Register callback for PID data
   */
  onData(pid: string, callback: (data: LiveData) => void): void {
    this.dataCallbacks.set(pid, callback);
  }

  /**
   * Disconnect from adapter
   */
  disconnect(): void {
    this.stopMonitoring();
    this.connection = null;
    this.dataCallbacks.clear();
    console.log("Disconnected from OBD adapter");
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connection?.connected || false;
  }
}
