/**
 * REAL BACKEND SERVER - NO PLACEHOLDERS
 *
 * Actual working implementations for all automotive operations
 */

import express from 'express';
import cors from 'cors';
import { spawn, exec } from 'child_process';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ============================================================================
// REAL COMMAND EXECUTION
// ============================================================================

/**
 * Execute shell command and return real output
 */
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          output: stderr || error.message,
          error: error.message
        });
      } else {
        resolve({
          success: true,
          output: stdout,
          error: null
        });
      }
    });
  });
}

app.post('/api/execute', async (req, res) => {
  const { command } = req.body;

  // Security: whitelist allowed commands
  const allowedCommands = [
    'hackrf_info',
    'hackrf_transfer',
    'rtl_test',
    'rtl_sdr',
    'rfcat',
    'pm3',
    'nfc-list',
    'candump',
    'cansend',
    'ip',
    'sudo'
  ];

  const cmdStart = command.split(' ')[0];
  if (!allowedCommands.some(allowed => command.startsWith(allowed))) {
    return res.status(403).json({
      success: false,
      error: 'Command not allowed'
    });
  }

  const result = await executeCommand(command);
  res.json(result);
});

// ============================================================================
// REAL OBD-II COMMUNICATION
// ============================================================================

let obdPort = null;
let obdParser = null;

/**
 * Connect to real OBD adapter via serial
 */
app.post('/api/obd/connect', async (req, res) => {
  const { port: portPath, baudRate } = req.body;

  try {
    // Close existing connection
    if (obdPort && obdPort.isOpen) {
      obdPort.close();
    }

    // Open serial port
    obdPort = new SerialPort({
      path: portPath || '/dev/rfcomm0',
      baudRate: baudRate || 38400
    });

    obdParser = obdPort.pipe(new ReadlineParser({ delimiter: '\r' }));

    // Initialize ELM327
    await sendOBDCommand('ATZ'); // Reset
    await new Promise(resolve => setTimeout(resolve, 1000));
    await sendOBDCommand('ATE0'); // Echo off
    await sendOBDCommand('ATL0'); // Linefeeds off
    await sendOBDCommand('ATSP0'); // Auto protocol

    res.json({
      success: true,
      message: 'Connected to OBD adapter'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Send command to OBD adapter
 */
function sendOBDCommand(command) {
  return new Promise((resolve, reject) => {
    if (!obdPort || !obdPort.isOpen) {
      reject(new Error('OBD port not open'));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Command timeout'));
    }, 5000);

    obdParser.once('data', (data) => {
      clearTimeout(timeout);
      resolve(data.toString().trim());
    });

    obdPort.write(command + '\r', (err) => {
      if (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  });
}

/**
 * Read PID from vehicle
 */
app.post('/api/obd/read-pid', async (req, res) => {
  const { pid } = req.body;

  try {
    const response = await sendOBDCommand(pid);

    // Parse response
    const value = parseOBDResponse(pid, response);

    res.json({
      success: true,
      pid,
      rawResponse: response,
      value
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Parse OBD-II response
 */
function parseOBDResponse(pid, response) {
  // Remove spaces and get hex bytes
  const bytes = response.replace(/\s/g, '').match(/.{2}/g) || [];

  // Skip mode and PID bytes
  const dataBytes = bytes.slice(2);

  // Parse based on PID
  switch (pid) {
    case '010C': // Engine RPM
      if (dataBytes.length >= 2) {
        return ((parseInt(dataBytes[0], 16) * 256 + parseInt(dataBytes[1], 16)) / 4);
      }
      break;
    case '010D': // Vehicle Speed
      if (dataBytes.length >= 1) {
        return parseInt(dataBytes[0], 16);
      }
      break;
    case '0105': // Coolant Temperature
      if (dataBytes.length >= 1) {
        return parseInt(dataBytes[0], 16) - 40;
      }
      break;
  }

  return null;
}

/**
 * Read DTCs
 */
app.get('/api/obd/dtcs', async (req, res) => {
  try {
    const response = await sendOBDCommand('03');

    // Parse DTC response
    const dtcs = parseDTCs(response);

    res.json({
      success: true,
      dtcs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Parse DTCs from response
 */
function parseDTCs(response) {
  const dtcs = [];
  const bytes = response.replace(/\s/g, '').match(/.{2}/g) || [];

  for (let i = 1; i < bytes.length; i += 2) {
    if (i + 1 < bytes.length) {
      const byte1 = parseInt(bytes[i], 16);
      const byte2 = parseInt(bytes[i + 1], 16);

      if (byte1 === 0 && byte2 === 0) break;

      const prefixes = ['P', 'C', 'B', 'U'];
      const prefix = prefixes[(byte1 & 0xC0) >> 6];
      const digit1 = (byte1 & 0x30) >> 4;
      const digit2 = byte1 & 0x0F;
      const digit34 = byte2.toString(16).padStart(2, '0').toUpperCase();

      dtcs.push(`${prefix}${digit1}${digit2}${digit34}`);
    }
  }

  return dtcs;
}

/**
 * Clear DTCs
 */
app.post('/api/obd/clear-dtcs', async (req, res) => {
  try {
    await sendOBDCommand('04');

    res.json({
      success: true,
      message: 'DTCs cleared'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// REAL CAN BUS COMMUNICATION
// ============================================================================

/**
 * Initialize CAN interface
 */
app.post('/api/can/init', async (req, res) => {
  const { interface: iface, bitrate } = req.body;

  try {
    // Bring down interface
    await executeCommand(`sudo ip link set ${iface} down`);

    // Configure CAN
    await executeCommand(`sudo ip link set ${iface} type can bitrate ${bitrate}`);

    // Bring up interface
    await executeCommand(`sudo ip link set ${iface} up`);

    res.json({
      success: true,
      message: `CAN interface ${iface} initialized at ${bitrate} bps`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Capture CAN traffic
 */
app.post('/api/can/capture', async (req, res) => {
  const { interface: iface, duration } = req.body;

  try {
    const result = await executeCommand(`timeout ${duration} candump ${iface}`);

    // Parse candump output
    const frames = result.output.split('\n').filter(line => line.trim()).map(line => {
      const parts = line.match(/\(([0-9.]+)\)\s+(\S+)\s+([0-9A-F]+)#([0-9A-F]*)/i);
      if (parts) {
        return {
          timestamp: parseFloat(parts[1]),
          interface: parts[2],
          id: parseInt(parts[3], 16),
          data: parts[4] ? Buffer.from(parts[4], 'hex') : Buffer.alloc(0)
        };
      }
      return null;
    }).filter(f => f !== null);

    res.json({
      success: true,
      frames
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Send CAN frame
 */
app.post('/api/can/send', async (req, res) => {
  const { interface: iface, canId, data } = req.body;

  try {
    const dataHex = Buffer.from(data).toString('hex');
    const canIdHex = canId.toString(16).padStart(3, '0');

    await executeCommand(`cansend ${iface} ${canIdHex}#${dataHex}`);

    res.json({
      success: true,
      message: 'CAN frame sent'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// REAL RF OPERATIONS
// ============================================================================

/**
 * Detect RF devices
 */
app.get('/api/rf/devices', async (req, res) => {
  const devices = [];

  // Check for HackRF
  const hackrf = await executeCommand('hackrf_info');
  if (hackrf.success && hackrf.output.includes('Found HackRF')) {
    devices.push({
      id: 'hackrf',
      name: 'HackRF One',
      type: 'hackrf',
      connected: true
    });
  }

  // Check for RTL-SDR
  const rtlsdr = await executeCommand('rtl_test -t 2>&1');
  if (rtlsdr.success && rtlsdr.output.includes('Found')) {
    devices.push({
      id: 'rtlsdr',
      name: 'RTL-SDR',
      type: 'rtlsdr',
      connected: true
    });
  }

  // Check for YardStick One
  const yardstick = await executeCommand('rfcat -r 2>&1');
  if (yardstick.success) {
    devices.push({
      id: 'yardstick',
      name: 'YardStick One',
      type: 'yardstick',
      connected: true
    });
  }

  res.json({
    success: true,
    devices
  });
});

/**
 * Capture RF signal
 */
app.post('/api/rf/capture', async (req, res) => {
  const { device, frequency, sampleRate, gain, duration } = req.body;

  try {
    const filename = `/tmp/rf_capture_${Date.now()}.raw`;
    let command;

    if (device === 'hackrf') {
      command = `hackrf_transfer -r ${filename} -f ${frequency} -s ${sampleRate} -g ${gain} -n ${sampleRate * duration}`;
    } else if (device === 'rtlsdr') {
      command = `rtl_sdr -f ${frequency} -s ${sampleRate} -g ${gain} -n ${sampleRate * duration} ${filename}`;
    }

    const result = await executeCommand(command);

    // Read captured file
    const data = fs.existsSync(filename) ? fs.readFileSync(filename) : null;

    res.json({
      success: result.success,
      filename,
      size: data ? data.length : 0,
      message: result.output
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Replay RF signal
 */
app.post('/api/rf/replay', async (req, res) => {
  const { device, filename, frequency, sampleRate, gain } = req.body;

  try {
    let command;

    if (device === 'hackrf') {
      command = `hackrf_transfer -t ${filename} -f ${frequency} -s ${sampleRate} -x ${gain}`;
    } else if (device === 'rtlsdr') {
      return res.status(400).json({
        success: false,
        error: 'RTL-SDR cannot transmit'
      });
    }

    const result = await executeCommand(command);

    res.json({
      success: result.success,
      message: result.output
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// REAL TRANSPONDER OPERATIONS
// ============================================================================

/**
 * Detect transponder reader
 */
app.get('/api/transponder/device', async (req, res) => {
  // Check for Proxmark3
  const pm3 = await executeCommand('pm3 --version');
  if (pm3.success && pm3.output.includes('Proxmark3')) {
    return res.json({
      success: true,
      device: 'proxmark3'
    });
  }

  // Check for ACR122U
  const acr = await executeCommand('nfc-list');
  if (acr.success && acr.output.includes('ACR122')) {
    return res.json({
      success: true,
      device: 'acr122u'
    });
  }

  res.json({
    success: false,
    device: null
  });
});

/**
 * Read transponder
 */
app.post('/api/transponder/read', async (req, res) => {
  const { device } = req.body;

  try {
    let result;

    if (device === 'proxmark3') {
      result = await executeCommand('pm3 -c "lf search"');
    } else if (device === 'acr122u') {
      result = await executeCommand('nfc-mfclassic r a dump.mfd');
    }

    res.json({
      success: result.success,
      output: result.output
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Clone transponder
 */
app.post('/api/transponder/clone', async (req, res) => {
  const { device, chipId, chipType } = req.body;

  try {
    let result;

    if (device === 'proxmark3') {
      if (chipType === 'hitag2') {
        result = await executeCommand(`pm3 -c "lf hitag2 clone --id ${chipId}"`);
      } else {
        result = await executeCommand(`pm3 -c "lf t55xx write --data ${chipId}"`);
      }
    }

    res.json({
      success: result.success,
      message: result.output
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

app.listen(PORT, () => {
  console.log(`🚀 Real Backend Server running on port ${PORT}`);
  console.log(`📡 All operations are REAL - no placeholders`);
  console.log(`🔧 Endpoints available at http://localhost:${PORT}/api/*`);
});

// Cleanup on exit
process.on('SIGINT', () => {
  if (obdPort && obdPort.isOpen) {
    obdPort.close();
  }
  process.exit(0);
});
