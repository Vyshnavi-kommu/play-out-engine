import { useState, useEffect, useCallback } from 'react'
import { api } from './utils/api'
import { paise2inr } from './utils/format'
import BalanceCard from './components/BalanceCard'
import PayoutForm from './components/PayoutForm'
import PayoutTable from './components/PayoutTable'
import LedgerTable from './components/LedgerTable'

// Need uuid for idempotency keys
const uuidv4 = () => crypto.randomUUID()

function MerchantTab({ merchant, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '0.6rem 1.25rem', borderRadius: 10, border: 'none', cursor: 'pointer',
      background: active ? 'var(--accent)' : 'var(--surface2)',
      color: active ? '#0a0a0f' : 'var(--muted)',
      fontWeight: active ? 700 : 500, fontSize: 13, fontFamily: 'Syne, sans-serif',
      transition: 'all 0.2s', letterSpacing: active ? 0.5 : 0,
    }}>{merchant.name}</button>
  )
}

function Spinner() {
  return <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--muted)' }}>Loading…</div>
}

export default function App() {
  const [merchants, setMerchants] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [merchant, setMerchant] = useState(null)
  const [payouts, setPayouts] = useState([])
  const [ledger, setLedger] = useState([])
  const [tab, setTab] = useState('payouts')
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    api.getMerchants().then(ms => {
      setMerchants(ms)
      if (ms.length) setSelectedId(ms[0].id)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    if (!selectedId) return
    Promise.all([
      api.getMerchant(selectedId),
      api.getPayouts(selectedId),
      api.getLedger(selectedId),
    ]).then(([m, ps, le]) => {
      setMerchant(m)
      setPayouts(ps)
      setLedger(le)
    })
  }, [selectedId, refreshKey])

  // Live polling every 5s for status updates
  useEffect(() => {
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [refresh])

  if (loading) return <Spinner />

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)', padding: '1rem 2rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 32, height: 32, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 16 }}>₹</span>
          </div>
          <div>
            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: 1 }}>PLAYTO</span>
            <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 8, fontFamily: 'IBM Plex Mono, monospace' }}>payout engine</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {merchants.map(m => (
            <MerchantTab key={m.id} merchant={m} active={m.id === selectedId} onClick={() => setSelectedId(m.id)} />
          ))}
        </div>
      </header>

      {merchant && (
        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Merchant info */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontWeight: 800, fontSize: 26 }}>{merchant.name}</h1>
              <p style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'IBM Plex Mono, monospace' }}>{merchant.email}</p>
            </div>
            <button onClick={refresh} style={{
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--muted)', borderRadius: 8, padding: '0.5rem 1rem',
              cursor: 'pointer', fontSize: 12, fontFamily: 'Syne, sans-serif',
            }}>↻ Refresh</button>
          </div>

          {/* Balance cards */}
          <BalanceCard
            available={merchant.available_balance_paise}
            held={merchant.held_balance_paise}
          />

          {/* Two-column layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: 8 }}>
                {['payouts', 'ledger'].map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{
                    padding: '0.5rem 1.25rem', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: tab === t ? 'var(--surface2)' : 'transparent',
                    color: tab === t ? 'var(--text)' : 'var(--muted)',
                    fontWeight: tab === t ? 600 : 400, fontSize: 13,
                    fontFamily: 'Syne, sans-serif', letterSpacing: 1, textTransform: 'uppercase',
                    borderBottom: tab === t ? `2px solid var(--accent)` : '2px solid transparent',
                  }}>{t}</button>
                ))}
              </div>
              {tab === 'payouts' ? (
                <PayoutTable payouts={payouts} />
              ) : (
                <LedgerTable entries={ledger} />
              )}
            </div>

            <PayoutForm merchant={merchant} onSuccess={refresh} />
          </div>
        </main>
      )}
    </div>
  )
}
