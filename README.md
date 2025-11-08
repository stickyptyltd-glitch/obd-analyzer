# OBD Diagnostic Analyzer

A powerful web application for analyzing OBD (On-Board Diagnostics) data from Car Scanner exports.

## Features

- 📁 **Multiple File Support**: Upload CSV or ZIP files containing Car Scanner exports
- 🔄 **Auto-Detection**: Automatically detects long (PID/VALUE) vs wide format data
- 📊 **Trip Summaries**: Key metrics per uploaded trip including:
  - Speed averages and maximums
  - Coolant temperature and warm-up times
  - MAF (Mass Air Flow) readings
  - Battery voltage monitoring
  - Fuel trim analysis (STFT/LTFT)
- 🔍 **Smart Analysis**: Rules engine checks for:
  - Coolant operating temperature issues
  - Fuel trim anomalies
  - MAF sensor problems
  - Low voltage events
  - GPS glitches
- 📈 **Interactive Charts**: Visualize trends for coolant, MAF, voltage, and fuel trims
- 💾 **Export Capability**: Download trip summaries as CSV
- 🔒 **Privacy First**: Everything runs locally in your browser - no data uploaded

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Usage

1. Export your OBD data from Car Scanner app as CSV or ZIP
2. Upload the files using the web interface
3. Review the automated analysis and findings
4. Explore the interactive charts
5. Export summaries if needed

## Technology Stack

- React + TypeScript
- Vite
- Tailwind CSS
- Recharts for data visualization
- PapaParse for CSV parsing
- JSZip for ZIP file handling
- Framer Motion for animations
- shadcn/ui components

## License

MIT
