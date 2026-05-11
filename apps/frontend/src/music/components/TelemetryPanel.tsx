// ─── TelemetryPanel ─────────────────────────────────────────────────────────
// Displays worker telemetry events for debugging and observability.

interface TelemetryPanelProps {
  events: Array<{ event: string; data: Record<string, unknown>; timestamp: number }>;
}

export function TelemetryPanel({ events }: TelemetryPanelProps) {
  if (events.length === 0) return null;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid #222',
      borderRadius: 8,
      padding: 12,
      maxHeight: 200,
      overflowY: 'auto',
    }}>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
        Telemetry
      </div>
      {events.slice().reverse().map((evt, i) => (
        <div key={i} style={{
          fontSize: 11,
          fontFamily: 'monospace',
          color: '#888',
          padding: '2px 0',
          borderBottom: '1px solid #1a1a2e',
        }}>
          <span style={{ color: '#7c3aed' }}>{evt.event}</span>
          {' '}
          <span style={{ color: '#555' }}>
            {Object.entries(evt.data)
              .map(([k, v]) => `${k}=${typeof v === 'number' ? (v as number).toFixed(1) : v}`)
              .join(' ')}
          </span>
        </div>
      ))}
    </div>
  );
}
