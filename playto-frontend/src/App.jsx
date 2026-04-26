import { useState, useEffect, useCallback } from 'react'
import { api } from './utils/api'
import BalanceCard from './components/BalanceCard'
import PayoutForm from './components/PayoutForm'
import PayoutTable from './components/PayoutTable'
import LedgerTable from './components/LedgerTable'
import AdminPanel from './components/AdminPanel'

function MerchantTab({ merchant, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.4rem 1rem',
        borderRadius: 99,
        border: active ? '1.5px solid var(--accent)' : '1px solid var(--border2)',
        cursor: 'pointer',
        background: active ? 'var(--accent-light)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--muted)',
        fontWeight: active ? 700 : 500,
        fontSize: 12,
        fontFamily: 'Syne, sans-serif',
        transition: 'all 0.15s',
        letterSpacing: 0.3,
        whiteSpace: 'nowrap',
      }}
    >
      {merchant.name}
    </button>
  )
}

function LiveDot() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
        boxShadow: '0 0 0 2px var(--accent-light)',
        animation: 'pulse 1.8s ease-in-out infinite',
      }} />
      <span style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1, fontFamily: 'Syne, sans-serif', textTransform: 'uppercase' }}>Live</span>
    </span>
  )
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', flexDirection: 'column', gap: 16, background: 'var(--bg)' }}>
      <div style={{ width: 36, height: 36, border: '3px solid var(--border2)', borderTop: '3px solid var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: 'var(--muted)', fontSize: 12, fontFamily: 'Syne, sans-serif', letterSpacing: 2, textTransform: 'uppercase' }}>Loading</p>
    </div>
  )
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
  const [lastUpdated, setLastUpdated] = useState(null)
  const [showAdmin, setShowAdmin] = useState(false)

  useEffect(() => {
    api.getMerchants().then(ms => {
      setMerchants(ms)
      if (ms.length) setSelectedId(ms[0].id)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1)
    setLastUpdated(new Date())
  }, [])

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
      setLastUpdated(new Date())
    })
  }, [selectedId, refreshKey])

  useEffect(() => {
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [refresh])

  if (loading) return <Spinner />

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        borderBottom: '1px solid var(--border)',
        padding: '0 2rem',
        height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 1px 0 var(--border), 0 2px 8px rgba(0,0,0,0.04)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 32, height: 32,
            background: 'var(--accent)',
            borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(5,150,105,0.3)',
          }}>
            <span style={{ fontSize: 16, color: '#fff', fontWeight: 800 }}>₹</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: 2, fontFamily: 'Syne, sans-serif', color: 'var(--text)' }}>PLAYTO</span>
            <span style={{ color: 'var(--muted)', fontSize: 9, fontFamily: 'IBM Plex Mono, monospace', letterSpacing: 1 }}>payout engine</span>
          </div>
        </div>

        {/* Center: merchant tabs (hidden in admin mode) */}
        {!showAdmin && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', flex: 1, margin: '0 1.5rem' }}>
            {merchants.map(m => (
              <MerchantTab key={m.id} merchant={m} active={m.id === selectedId} onClick={() => setSelectedId(m.id)} />
            ))}
          </div>
        )}

        {showAdmin && (
          <div style={{ flex: 1, textAlign: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'Syne, sans-serif', letterSpacing: 1 }}>
              ADMIN PORTAL
            </span>
          </div>
        )}

        {/* Right: live dot + admin toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {!showAdmin && <LiveDot />}
          <button
            onClick={() => setShowAdmin(v => !v)}
            style={{
              padding: '0.4rem 0.9rem',
              borderRadius: 8,
              border: showAdmin ? '1.5px solid var(--accent)' : '1px solid var(--border2)',
              cursor: 'pointer',
              background: showAdmin ? 'var(--accent)' : 'var(--surface2)',
              color: showAdmin ? '#fff' : 'var(--muted)',
              fontWeight: 600,
              fontSize: 11,
              fontFamily: 'Syne, sans-serif',
              letterSpacing: 1,
              transition: 'all 0.15s',
            }}
          >
            {showAdmin ? '← Merchant' : 'Admin ⚙'}
          </button>
        </div>
      </header>

      {/* Admin portal */}
      {showAdmin && (
        <main style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem' }}>
          <AdminPanel />
        </main>
      )}

      {/* Merchant dashboard */}
      {!showAdmin && merchant && (
        <main style={{ maxWidth: 1160, margin: '0 auto', padding: '2.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>

          {/* Merchant hero row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div className="fade-up">
              <p style={{ fontSize: 10, letterSpacing: 3, color: 'var(--muted)', textTransform: 'uppercase', fontFamily: 'Syne, sans-serif', marginBottom: 5 }}>
                Merchant Account
              </p>
              <h1 style={{ fontWeight: 800, fontSize: 26, letterSpacing: -0.5, lineHeight: 1, color: 'var(--text)' }}>{merchant.name}</h1>
              <p style={{ color: 'var(--muted)', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', marginTop: 4 }}>
                {merchant.email}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {lastUpdated && (
                <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'IBM Plex Mono, monospace' }}>
                  {lastUpdated.toLocaleTimeString('en-IN', { timeStyle: 'short' })}
                </span>
              )}
              <button
                onClick={refresh}
                style={{
                  background: 'var(--surface)', border: '1px solid var(--border2)',
                  color: 'var(--muted)', borderRadius: 8, padding: '0.4rem 0.85rem',
                  cursor: 'pointer', fontSize: 12, fontFamily: 'Syne, sans-serif',
                  letterSpacing: 0.5, transition: 'all 0.15s',
                  boxShadow: 'var(--shadow-sm)',
                }}
                onMouseEnter={e => { e.target.style.color = 'var(--accent)'; e.target.style.borderColor = 'var(--accent)' }}
                onMouseLeave={e => { e.target.style.color = 'var(--muted)'; e.target.style.borderColor = 'var(--border2)' }}
              >↻ Refresh</button>
            </div>
          </div>

          {/* Balance cards */}
          <BalanceCard available={merchant.available_balance_paise} held={merchant.held_balance_paise} />

          {/* Split: table | form */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>

            {/* Left: tabs + table */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 4, boxShadow: 'var(--shadow-sm)' }}>
                {['payouts', 'ledger'].map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    style={{
                      flex: 1, padding: '0.5rem', borderRadius: 9, border: 'none',
                      cursor: 'pointer',
                      background: tab === t ? 'var(--accent-light)' : 'transparent',
                      color: tab === t ? 'var(--accent)' : 'var(--muted)',
                      fontWeight: tab === t ? 700 : 500, fontSize: 12,
                      fontFamily: 'Syne, sans-serif', letterSpacing: 1.5, textTransform: 'uppercase',
                      transition: 'all 0.15s',
                      boxShadow: tab === t ? 'inset 0 0 0 1.5px var(--accent)30' : 'none',
                    }}
                  >{t}</button>
                ))}
              </div>

              {tab === 'payouts' ? (
                <PayoutTable payouts={payouts} />
              ) : (
                <LedgerTable entries={ledger} />
              )}
            </div>

            {/* Right: payout form — key resets state when merchant changes */}
            <PayoutForm key={merchant.id} merchant={merchant} onSuccess={refresh} />
          </div>
        </main>
      )}
    </div>
  )
}
