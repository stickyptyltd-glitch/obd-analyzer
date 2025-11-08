import http from 'http';
import fs from 'fs';
import path from 'path';

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
