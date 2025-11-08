#!/data/data/com.termux/files/usr/bin/bash

echo "================================"
echo "🔧 OBD Analyzer Comprehensive Diagnosis"
echo "================================"
echo ""

# Step 1: Check Node and NPM
echo "📦 Step 1: Checking Node.js and NPM..."
node --version
npm --version
echo "✅ Node.js and NPM installed"
echo ""

# Step 2: Check if port 5173 is in use
echo "🔌 Step 2: Checking port 5173..."
if lsof -i :5173 2>/dev/null || netstat -tlnp 2>/dev/null | grep 5173 || ss -tlnp 2>/dev/null | grep 5173; then
    echo "⚠️  Port 5173 is in use - killing processes..."
    pkill -f "vite"
    sleep 2
else
    echo "✅ Port 5173 is free"
fi
echo ""

# Step 3: Verify project structure
echo "📁 Step 3: Verifying project structure..."
cd /data/data/com.termux/files/home/obd-analyzer || exit 1

if [ -f "package.json" ]; then
    echo "✅ package.json found"
else
    echo "❌ package.json missing!"
    exit 1
fi

if [ -d "node_modules" ]; then
    echo "✅ node_modules exists"
else
    echo "⚠️  node_modules missing - running npm install..."
    npm install
fi

if [ -d "src" ]; then
    echo "✅ src directory exists"
else
    echo "❌ src directory missing!"
    exit 1
fi
echo ""

# Step 4: Check critical files
echo "📄 Step 4: Checking critical files..."
CRITICAL_FILES=(
    "src/main.tsx"
    "src/App.tsx"
    "src/components/OBDAnalyzer.tsx"
    "src/lib/diagnostics.ts"
    "src/lib/statistics.ts"
    "index.html"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file MISSING!"
    fi
done
echo ""

# Step 5: Check for syntax errors
echo "🔍 Step 5: Checking for TypeScript/JavaScript syntax errors..."
echo "Running TypeScript compiler check (errors are OK for now)..."
npx tsc --noEmit 2>&1 | head -20
echo ""

# Step 6: Try building
echo "🏗️  Step 6: Attempting production build..."
npm run build 2>&1 | tail -30
BUILD_EXIT=$?

if [ $BUILD_EXIT -eq 0 ]; then
    echo "✅ Build succeeded!"
    echo ""
    echo "📦 Build output:"
    ls -lh dist/ 2>/dev/null || echo "No dist folder"
else
    echo "❌ Build failed with errors above"
fi
echo ""

# Step 7: Create simple test server
echo "🌐 Step 7: Creating simple test server..."
cat > test-server.js << 'EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>OBD Analyzer Test</title>
    <style>
        body { font-family: Arial; padding: 40px; background: #1a1a1a; color: #fff; }
        h1 { color: #4CAF50; }
        .success { color: #4CAF50; }
        .error { color: #f44336; }
        button { padding: 15px 30px; font-size: 18px; margin: 10px; cursor: pointer; background: #2196F3; color: white; border: none; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>✅ Simple HTTP Server is Working!</h1>
    <p class="success">If you can see this, your browser CAN access localhost servers.</p>
    <p>Port: 8080</p>
    <p>Time: ${new Date().toLocaleString()}</p>
    <button onclick="testVite()">Test Vite Server (5173)</button>
    <div id="result"></div>
    <script>
        async function testVite() {
            const result = document.getElementById('result');
            try {
                const response = await fetch('http://localhost:5173/');
                if (response.ok) {
                    result.innerHTML = '<p class="success">✅ Vite server is responding!</p>';
                    setTimeout(() => {
                        window.location.href = 'http://localhost:5173/';
                    }, 1000);
                } else {
                    result.innerHTML = '<p class="error">❌ Vite server error: ' + response.status + '</p>';
                }
            } catch (e) {
                result.innerHTML = '<p class="error">❌ Cannot reach Vite server: ' + e.message + '</p>';
            }
        }
    </script>
</body>
</html>
        `);
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\\n✅ Test server running at http://localhost:${PORT}/`);
    console.log(`   Access from browser: http://localhost:${PORT}/\\n`);
});
EOF

echo "✅ Test server script created: test-server.js"
echo ""

# Step 8: Summary
echo "================================"
echo "📋 DIAGNOSIS SUMMARY"
echo "================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Start test server:"
echo "   node test-server.js"
echo "   Then open: http://localhost:8080/"
echo ""
echo "2. If test server works, start Vite:"
echo "   npm run dev -- --host 0.0.0.0"
echo "   Then open: http://localhost:5173/"
echo ""
echo "3. If Vite doesn't load, check browser console (F12)"
echo ""

echo "================================"
echo "✅ Diagnosis complete!"
echo "================================"
