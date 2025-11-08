# 🔓 CAN Bus Reverse Engineering Guide

## ⚠️ Legal & Ethical Notice

This guide is for **AUTHORIZED RESEARCH ONLY** on vehicles you own or have explicit written permission to modify.

**Legal Uses:**
- Modifying your own vehicle
- Academic research with proper authorization
- Open-source automotive projects (OpenPilot, comma.ai)
- Custom ECU tuning on personal vehicles
- Developing aftermarket accessories
- Security research for defensive purposes

**Illegal Uses:**
- Tampering with vehicles you don't own
- Defeating emissions controls
- Odometer fraud
- Vehicle theft
- Insurance fraud

---

## 🎯 What is CAN Bus Reverse Engineering?

CAN (Controller Area Network) bus is the nervous system of modern vehicles, carrying messages between ECUs (Engine Control Units). Reverse engineering allows you to:

1. **Understand vehicle data** without manufacturer documentation
2. **Create custom modifications** (HUD displays, data loggers, etc.)
3. **Develop DBC files** for unsupported vehicles
4. **Enable hidden features** disabled by manufacturer
5. **Build custom diagnostic tools**

---

## 🛠️ Tools Required

### Hardware
- **CAN Interface** - Connect to vehicle's OBD-II port
  - Recommended: CANable ($50), Comma.ai Panda ($99), ValueCAN 4 ($400)
  - Budget: ELM327 v1.5 ($10-30, limited support)

- **Raspberry Pi 4** or Linux laptop with SocketCAN support

### Software
- **SocketCAN** - Linux kernel CAN protocol stack (built-in)
- **can-utils** - Command-line tools for CAN bus
- **python-can** - Python library for CAN communication
- **SavvyCAN** - GUI for CAN bus reverse engineering
- **Wireshark** - CAN traffic analysis with candump
- **OpenDBC** - Collection of open-source DBC files

---

## 📚 CAN Bus Basics

### Message Structure

```
CAN Message:
[ID] [DLC] [DATA 0-8 bytes]

Example:
0x123 [8] 01 02 03 04 05 06 07 08
│     │   └─ Data bytes (values)
│     └─ Data Length Code (number of bytes)
└─ CAN ID (unique message identifier)
```

### Common CAN IDs (Vehicle Dependent)

```
Engine RPM:     0x201, 0x0C6, 0x316 (varies by manufacturer)
Vehicle Speed:  0x221, 0x0B4, 0x348
Steering Angle: 0x025, 0x0E4, 0x002
Brake Pressure: 0x026, 0x0D1, 0x040
Throttle:       0x244, 0x1F5, 0x123
```

---

## 🚀 Step-by-Step Reverse Engineering

### Step 1: Setup SocketCAN on Linux

```bash
# Load kernel modules
sudo modprobe can
sudo modprobe can-raw
sudo modprobe vcan

# Create virtual CAN interface (for testing)
sudo ip link add dev vcan0 type vcan
sudo ip link set up vcan0

# Setup real CAN interface (with hardware)
sudo ip link set can0 type can bitrate 500000
sudo ip link set up can0
```

### Step 2: Capture CAN Traffic

```bash
# Dump all CAN messages to terminal
candump can0

# Save to file for analysis
candump -l can0

# Filter by CAN ID
candump can0,123:7FF  # Only show ID 0x123

# Log with timestamps
candump -ta can0 > can_log.txt
```

### Step 3: Identify Signals

#### Method 1: Isolation Testing

1. **Start engine** and watch for changing messages
2. **Press brake pedal** → find brake signal
3. **Turn steering wheel** → find steering angle
4. **Accelerate** → find throttle/RPM signals

#### Method 2: Statistical Analysis

```python
import can
from collections import Counter

# Connect to CAN bus
bus = can.interface.Bus(channel='can0', bustype='socketcan')

# Count message frequencies
message_counter = Counter()

for msg in bus:
    message_counter[msg.arbitration_id] += 1

# High-frequency messages = sensor data (RPM, speed, etc.)
# Low-frequency messages = events (door open, button press)
print(message_counter.most_common(20))
```

### Step 4: Decode Signal Values

#### Find RPM Signal

```python
import can

bus = can.interface.Bus(channel='can0', bustype='socketcan')

# Monitor CAN ID 0x201 (example)
for msg in bus:
    if msg.arbitration_id == 0x201:
        # Try different byte combinations
        rpm_raw = (msg.data[0] << 8) | msg.data[1]  # Big-endian
        rpm = rpm_raw * 0.25  # Scaling factor (trial and error)
        print(f"RPM: {rpm}")
```

#### Common Signal Encodings

```python
# Big-Endian (most common)
value = (data[0] << 8) | data[1]

# Little-Endian
value = (data[1] << 8) | data[0]

# Signed values
if value > 32767:
    value -= 65536

# Floating point (scaling)
real_value = value * scaling_factor + offset

# Example RPM: raw_value * 0.25
# Example Speed: raw_value * 0.01 (km/h)
# Example Temp: raw_value * 0.1 - 40 (°C)
```

---

## 🧪 Automated Reverse Engineering

### Using CANMatch (Research Tool)

```bash
# Install CANMatch
git clone https://github.com/CANMatch/CANMatch
cd CANMatch
python canmatch.py --input can_log.txt --output signals.dbc
```

### Using ByCAN (2024 Research)

ByCAN performs bit-level reverse engineering:
- Automatically identifies signal boundaries
- Detects scaling factors and offsets
- Works without prior knowledge of vehicle

```python
# Conceptual example (research paper)
from bycan import BitLevelAnalyzer

analyzer = BitLevelAnalyzer('can_traffic.log')
signals = analyzer.detect_signals()

for signal in signals:
    print(f"ID: 0x{signal.can_id:03X}")
    print(f"Bit position: {signal.start_bit}")
    print(f"Length: {signal.bit_length}")
    print(f"Scaling: {signal.scale} * x + {signal.offset}")
```

---

## 📝 Creating DBC Files

### DBC File Format

```
VERSION ""

NS_ :
  NS_DESC_
  CM_
  BA_DEF_
  BA_
  VAL_
  CAT_DEF_
  CAT_
  FILTER
  BA_DEF_DEF_
  EV_DATA_
  ENVVAR_DATA_
  SGTYPE_
  SGTYPE_VAL_
  BA_DEF_SGTYPE_
  BA_SGTYPE_
  SIG_TYPE_REF_
  VAL_TABLE_
  SIG_GROUP_
  SIG_VALTYPE_
  SIGTYPE_VALTYPE_
  BO_TX_BU_
  BA_DEF_REL_
  BA_REL_
  BA_SGTYPE_REL_
  SG_MUL_VAL_

BS_:

BU_: Engine Transmission ABS

BO_ 513 EngineData: 8 Engine
 SG_ EngineRPM : 0|16@1+ (0.25,0) [0|16383.75] "rpm" Vector__XXX
 SG_ ThrottlePosition : 16|8@1+ (0.39,0) [0|100] "%" Vector__XXX
 SG_ EngineCoolantTemp : 24|8@1+ (1,-40) [-40|215] "°C" Vector__XXX
```

### Generate DBC with Python

```python
import cantools

# Create database
db = cantools.database.Database()

# Add message
message = cantools.database.Message(
    frame_id=0x201,
    name='EngineData',
    length=8,
    senders=['Engine']
)

# Add signal
signal = cantools.database.Signal(
    name='EngineRPM',
    start=0,
    length=16,
    byte_order='big_endian',
    scale=0.25,
    offset=0,
    unit='rpm',
    minimum=0,
    maximum=16383.75
)

message.signals.append(signal)
db.messages.append(message)

# Save to DBC file
with open('vehicle.dbc', 'w') as f:
    f.write(db.as_dbc_string())
```

---

## 🎨 Practical Applications

### 1. Custom Dashboard (React + python-can)

```python
# Backend: CAN data server
import can
from flask import Flask, jsonify
from flask_socketio import SocketIO

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
bus = can.interface.Bus(channel='can0', bustype='socketcan')

def read_can():
    while True:
        msg = bus.recv()
        if msg.arbitration_id == 0x201:  # Engine data
            rpm = ((msg.data[0] << 8) | msg.data[1]) * 0.25
            socketio.emit('rpm', {'value': rpm})

@socketio.on('connect')
def handle_connect():
    socketio.start_background_task(read_can)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000)
```

### 2. Enable Hidden Features

Many vehicles have features disabled via CAN messages:

```python
import can
import time

bus = can.interface.Bus(channel='can0', bustype='socketcan')

# Example: Enable sport mode (vehicle-specific!)
enable_sport = can.Message(
    arbitration_id=0x350,
    data=[0x01, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
    is_extended_id=False
)

# Send message
bus.send(enable_sport)
print("Sport mode enabled!")
```

**Warning:** Only modify YOUR vehicle. Incorrect CAN messages can cause:
- ECU errors
- Warning lights
- Safety system disabling
- Potential vehicle damage

### 3. Data Logger

```python
import can
import csv
from datetime import datetime

bus = can.interface.Bus(channel='can0', bustype='socketcan')

with open(f'can_log_{datetime.now()}.csv', 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['Timestamp', 'CAN_ID', 'Data'])

    for msg in bus:
        writer.writerow([
            msg.timestamp,
            f"0x{msg.arbitration_id:03X}",
            ' '.join(f"{b:02X}" for b in msg.data)
        ])
```

---

## 🔍 Advanced Techniques

### Fuzzing CAN Messages

**⚠️ DANGEROUS - Only on YOUR vehicle in safe environment**

```python
import can
import time
import random

bus = can.interface.Bus(channel='can0', bustype='socketcan')

# Fuzz specific CAN ID
can_id = 0x123
for i in range(256):
    msg = can.Message(
        arbitration_id=can_id,
        data=[i, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
    )
    bus.send(msg)
    time.sleep(0.1)
    print(f"Sent: {i:02X} - Observe vehicle response")
```

### Replay Attack Detection

```python
import can
from collections import deque

bus = can.interface.Bus(channel='can0', bustype='socketcan')
recent_messages = deque(maxlen=100)

for msg in bus:
    msg_sig = (msg.arbitration_id, tuple(msg.data))

    if recent_messages.count(msg_sig) > 5:
        print(f"⚠️ REPLAY ATTACK DETECTED: {msg}")

    recent_messages.append(msg_sig)
```

---

## 📦 Open Source DBC Databases

### OpenDBC (Comma.ai)

```bash
# Clone OpenDBC
git clone https://github.com/commaai/opendbc
cd opendbc

# DBC files available for:
# - Toyota (Camry, Corolla, RAV4, Prius)
# - Honda (Civic, Accord, CR-V)
# - Hyundai (Sonata, Elantra, Kona)
# - GM, Ford, Tesla, BMW, VW, and more
```

### Use DBC File with python-can

```python
import can
import cantools

# Load DBC file
db = cantools.database.load_file('toyota_camry_2018.dbc')

bus = can.interface.Bus(channel='can0', bustype='socketcan')

for msg in bus:
    try:
        # Decode message using DBC
        decoded = db.decode_message(msg.arbitration_id, msg.data)
        print(f"Speed: {decoded.get('SPEED')} km/h")
        print(f"RPM: {decoded.get('ENGINE_RPM')} rpm")
    except KeyError:
        pass  # Message not in DBC
```

---

## 🧰 Recommended Tools

| Tool | Purpose | Cost |
|------|---------|------|
| **SavvyCAN** | GUI for reverse engineering | Free |
| **Wireshark** | CAN traffic analysis | Free |
| **CANalyzer** (Vector) | Professional analysis | $$$$ |
| **BusMaster** | Open-source alternative | Free |
| **ICSim** | CAN simulator for practice | Free |
| **python-can** | Python library | Free |
| **OpenDBC** | DBC file database | Free |

---

## 🎓 Learning Resources

### Tutorials
- **Part 1-3: CAN Bus Reverse Engineering With SocketCAN** by David Evans (Medium)
- **CSS Electronics CAN Bus Guides** - https://www.csselectronics.com/pages/can-bus-sniffer-reverse-engineering
- **OpenVehicles DBC Primer** - https://docs.openvehicles.com

### Research Papers
- **ByCAN: Reverse Engineering CAN Messages** (2024) - Bit-level automated RE
- **CANMatch: Fully Automated CAN Reverse Engineering** - Message pattern matching

### Practice Environments
- **ICSim** - Instrument Cluster Simulator for safe practice
- **Virtual CAN (vcan)** - Test without real hardware

---

## ⚡ Integration with OBD Analyzer Pro

Your OBD Analyzer Pro can now leverage CAN bus data:

1. **Export CAN logs** from your data logger
2. **Analyze with reverse engineering tools**
3. **Create custom PIDs** for undocumented signals
4. **Import into OBD Analyzer** for comprehensive diagnostics

---

## 🔒 Security Implications

### Vulnerabilities Found Through RE:
- Fixed-code immobilizers (pre-1995)
- Lack of CAN message authentication
- Unauthenticated ECU firmware updates
- Diagnostic backdoors

### Responsible Disclosure:
- Report vulnerabilities to manufacturer
- Allow 90 days for patch before public disclosure
- Coordinate with security researchers (DEFCON, Black Hat)

---

## 📋 Legal Compliance Checklist

Before reverse engineering:

- [ ] I own this vehicle OR have written authorization
- [ ] I will NOT defeat emissions controls
- [ ] I will NOT commit odometer fraud
- [ ] I will NOT use this for vehicle theft
- [ ] I will NOT violate DMCA/CFAA laws
- [ ] I will report security vulnerabilities responsibly

---

## 🎯 Quick Start Project: Read Engine RPM

```python
#!/usr/bin/env python3
import can
import time

# Setup CAN bus
bus = can.interface.Bus(channel='can0', bustype='socketcan')

print("Listening for CAN messages... Press Ctrl+C to stop")
print("Start your engine and rev it to see patterns")

try:
    while True:
        msg = bus.recv(timeout=1.0)
        if msg:
            # Print all messages to identify RPM signal
            data_str = ' '.join(f"{b:02X}" for b in msg.data)
            print(f"ID: 0x{msg.arbitration_id:03X} Data: {data_str}")
except KeyboardInterrupt:
    print("\nStopped.")
```

**Next Steps:**
1. Rev engine and watch for changing values
2. Note CAN ID with values matching RPM
3. Calculate scaling factor (usually 0.25 or 0.5)
4. Create decoder function

---

*Last Updated: November 2025*
*For educational and authorized research purposes only*
