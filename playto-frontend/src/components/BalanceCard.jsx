import { paise2inr } from '../utils/format'

function Card({ label, value, color, bg, sub, pct, icon }) {
  return (
    <div style={{
      flex: 1, background: 'var(--surface)', borderRadius: 16,
      padding: '1.5rem 1.75rem', boxShadow: 'var(--shadow)',
      border: '1px solid var(--border)', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 120, height: 120,
        background: bg, borderRadius: '0 16px 0 120px', opacity: 0.6,
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'Syne, sans-serif' }}>
          {label}
        </p>
      </div>
      <p style={{ fontSize: 32, fontWeight: 800, color, fontFamily: 'IBM Plex Mono, monospace', letterSpacing: -1, lineHeight: 1 }}>
        {value}
      </p>
      <div style={{ marginTop: 14, height: 4, background: 'var(--border)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 2, transition: 'width 0.6s ease' }} />
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{sub}</p>
    </div>
  )
}

export default function BalanceCard({ available, held }) {
  const total = available + held || 1
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <Card
        icon="💰" label="Available Balance"
        value={paise2inr(available)} color="var(--accent)" bg="var(--accent-light)"
        sub="Ready to withdraw" pct={(available / total) * 100}
      />
      <Card
        icon="⏳" label="On Hold"
        value={paise2inr(held)} color={held > 0 ? 'var(--warn)' : 'var(--muted2)'} bg={held > 0 ? 'var(--warn-light)' : 'var(--surface2)'}
        sub="Processing payouts" pct={(held / total) * 100}
      />
    </div>
  )
}
