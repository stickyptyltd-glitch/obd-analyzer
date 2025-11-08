export default function TestSimple() {
  return (
    <div style={{ padding: '40px', background: '#000', color: '#0f0', fontFamily: 'monospace', minHeight: '100vh' }}>
      <h1>✅ React is Loading!</h1>
      <p>If you see this, React and Vite are working correctly.</p>
      <p>Time: {new Date().toLocaleString()}</p>
    </div>
  );
}
