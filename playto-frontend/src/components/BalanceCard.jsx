import { paise2inr } from '../utils/format'

export default function BalanceCard({ available, held }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ background: 'var(--surface)', padding: '2rem' }}>
        <p style={{ color: 'var(--muted)', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>Available</p>
        <p style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent)', fontFamily: 'IBM Plex Mono, monospace' }}>
          {paise2inr(available)}
        </p>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>Ready to withdraw</p>
      </div>
      <div style={{ background: 'var(--surface)', padding: '2rem' }}>
        <p style={{ color: 'var(--muted)', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>Held</p>
        <p style={{ fontSize: 36, fontWeight: 800, color: 'var(--warn)', fontFamily: 'IBM Plex Mono, monospace' }}>
          {paise2inr(held)}
        </p>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>Processing payouts</p>
      </div>
    </div>
  )
}
