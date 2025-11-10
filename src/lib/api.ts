/**
 * REAL API CLIENT - Calls actual backend server
 */

const API_BASE = 'http://localhost:3001/api';

export class RealAPI {
  /**
   * Execute shell command via backend
   */
  static async executeCommand(command: string): Promise<{
    success: boolean;
    output: string;
    error: string | null;
  }> {
    const response = await fetch(`${API_BASE}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });
    return response.json();
  }

  // ============================================================================
  // OBD-II Operations
  // ============================================================================

  static async obdConnect(port: string, baudRate: number = 38400) {
    const response = await fetch(`${API_BASE}/obd/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ port, baudRate })
    });
    return response.json();
  }

  static async obdReadPID(pid: string) {
    const response = await fetch(`${API_BASE}/obd/read-pid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid })
    });
    return response.json();
  }

  static async obdGetDTCs() {
    const response = await fetch(`${API_BASE}/obd/dtcs`);
    return response.json();
  }

  static async obdClearDTCs() {
    const response = await fetch(`${API_BASE}/obd/clear-dtcs`, {
      method: 'POST'
    });
    return response.json();
  }

  // ============================================================================
  // CAN Bus Operations
  // ============================================================================

  static async canInit(iface: string, bitrate: number) {
    const response = await fetch(`${API_BASE}/can/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interface: iface, bitrate })
    });
    return response.json();
  }

  static async canCapture(iface: string, duration: number) {
    const response = await fetch(`${API_BASE}/can/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interface: iface, duration })
    });
    return response.json();
  }

  static async canSend(iface: string, canId: number, data: number[]) {
    const response = await fetch(`${API_BASE}/can/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interface: iface, canId, data })
    });
    return response.json();
  }

  // ============================================================================
  // RF Operations
  // ============================================================================

  static async rfGetDevices() {
    const response = await fetch(`${API_BASE}/rf/devices`);
    return response.json();
  }

  static async rfCapture(params: {
    device: string;
    frequency: number;
    sampleRate: number;
    gain: number;
    duration: number;
  }) {
    const response = await fetch(`${API_BASE}/rf/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return response.json();
  }

  static async rfReplay(params: {
    device: string;
    filename: string;
    frequency: number;
    sampleRate: number;
    gain: number;
  }) {
    const response = await fetch(`${API_BASE}/rf/replay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return response.json();
  }

  // ============================================================================
  // Transponder Operations
  // ============================================================================

  static async transponderGetDevice() {
    const response = await fetch(`${API_BASE}/transponder/device`);
    return response.json();
  }

  static async transponderRead(device: string) {
    const response = await fetch(`${API_BASE}/transponder/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device })
    });
    return response.json();
  }

  static async transponderClone(device: string, chipId: string, chipType: string) {
    const response = await fetch(`${API_BASE}/transponder/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device, chipId, chipType })
    });
    return response.json();
  }
}
