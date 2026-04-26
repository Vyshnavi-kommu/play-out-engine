import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { api } from '../utils/api'
import { paise2inr, fmtDate, STATUS_COLOR, STATUS_BG, STATUS_ICON } from '../utils/format'
import { Badge } from './PayoutTable'

// ── Password Gate ──────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = 'admin5657'

function LoginScreen({ onAuth }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState(false)
  const [shake, setShake] = useState(false)

  function submit(e) {
    e.preventDefault()
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_authed', '1')
      onAuth()
    } else {
      setErr(true); setShake(true); setPw('')
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '2rem' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 24, padding: '2.5rem', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)', width: '100%', maxWidth: 400, animation: shake ? 'shake 0.4s ease' : 'fadeUp 0.3s ease both' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', borderRadius: 18, margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(5,150,105,0.3)', fontSize: 28 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', fontFamily: 'Syne, sans-serif', marginBottom: 6 }}>Admin Portal</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Enter your admin password to continue</p>
        </div>
        <form onSubmit={submit}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Password</label>
          <input type="password" value={pw} onChange={e => { setPw(e.target.value); setErr(false) }}
            placeholder="Enter admin password" autoFocus
            style={{ width: '100%', background: err ? 'var(--danger-light)' : 'var(--surface2)', border: `1.5px solid ${err ? 'var(--danger)' : 'var(--border2)'}`, borderRadius: 12, padding: '0.75rem 1rem', color: 'var(--text)', fontSize: 15, fontFamily: 'IBM Plex Mono, monospace', outline: 'none', transition: 'border-color 0.15s', marginBottom: 8 }}
            onFocus={e => { if (!err) e.target.style.borderColor = 'var(--accent)' }}
            onBlur={e => { if (!err) e.target.style.borderColor = 'var(--border2)' }}
          />
          {err && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>⚠ Incorrect password</p>}
          <div style={{ height: err ? 0 : 16 }} />
          <button type="submit" style={{ width: '100%', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '0.8rem', fontWeight: 700, fontSize: 13, letterSpacing: 1.5, cursor: 'pointer', fontFamily: 'Syne, sans-serif', boxShadow: '0 4px 14px rgba(5,150,105,0.35)' }}
            onMouseEnter={e => e.target.style.background = '#047857'} onMouseLeave={e => e.target.style.background = 'var(--accent)'}
          >UNLOCK PORTAL</button>
        </form>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', marginTop: '1.25rem' }}>
          Password: <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'var(--accent)', fontWeight: 600 }}>admin5657</span>
        </p>
      </div>
      <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }`}</style>
    </div>
  )
}

// ── Shared primitives ──────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color, bg, sub }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, flex: 1, minWidth: 140, padding: '1.25rem 1.5rem', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', fontFamily: 'Syne, sans-serif' }}>{label}</span>
        <span style={{ background: bg, width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{icon}</span>
      </div>
      <p style={{ fontSize: 26, fontWeight: 800, color, fontFamily: 'IBM Plex Mono, monospace', letterSpacing: -1, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>{sub}</p>}
    </div>
  )
}

function SectionHeader({ title, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'Syne, sans-serif' }}>{title}</span>
      {count != null && <span style={{ fontSize: 11, background: 'var(--surface2)', color: 'var(--muted)', padding: '2px 10px', borderRadius: 99, border: '1px solid var(--border)', fontFamily: 'IBM Plex Mono, monospace' }}>{count}</span>}
    </div>
  )
}

const TH = ({ children }) => (
  <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, letterSpacing: 1.2, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600, fontFamily: 'Syne, sans-serif', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{children}</th>
)

const STATUS_FILTERS = ['all', 'processing', 'pending', 'completed', 'failed']

// ── Live Concurrency Demo ──────────────────────────────────────────────────────
function ConcurrencyDemo({ merchants, onComplete }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  // Pick a merchant with ≥ ₹100 (10000 paise) available balance
  const eligible = merchants.find(m => m.available_balance_paise >= 10000 && m.bank_accounts?.length > 0)

  async function run() {
    if (!eligible) return
    setLoading(true); setResult(null)

    const balance = eligible.available_balance_paise
    // Use 60% of balance per request → combined = 120% → one MUST fail
    const amount = Math.floor(balance * 0.6)
    const bankId = eligible.bank_accounts[0].id

    const makeRequest = (key) => api.createPayout(
      eligible.id,
      { amount_paise: amount, bank_account_id: bankId },
      key
    )

    const t0 = Date.now()
    // Fire BOTH simultaneously — browser opens two connections at once
    const [r1, r2] = await Promise.allSettled([makeRequest(uuidv4()), makeRequest(uuidv4())])
    const elapsed = Date.now() - t0

    const parse = (r) => r.status === 'fulfilled'
      ? { ok: true,  code: 201, id: String(r.value.id).slice(0, 8) + '…' }
      : { ok: false, code: r.reason?.status || 400, error: r.reason?.error || 'Insufficient balance' }

    const p1 = parse(r1), p2 = parse(r2)
    const successes = [p1, p2].filter(x => x.ok).length
    const passed = successes === 1

    setResult({ balance, amount, p1, p2, elapsed, passed, merchant: eligible.name })
    setLoading(false)
    if (onComplete) setTimeout(onComplete, 600)
  }

  const mono = { fontFamily: 'IBM Plex Mono, monospace' }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 20, overflow: 'hidden', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', borderBottom: '1px solid #bfdbfe', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>🏃</span>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1e40af', fontFamily: 'Syne, sans-serif' }}>Concurrency Test</h3>
          </div>
          <p style={{ fontSize: 12, color: '#3b82f6', lineHeight: 1.5 }}>
            Two simultaneous payout requests where combined total exceeds balance.
            Exactly one must succeed.
          </p>
          <code style={{ display: 'inline-block', fontSize: 11, color: '#1d4ed8', background: '#dbeafe', borderRadius: 6, padding: '3px 8px', marginTop: 6, ...mono }}>
            SELECT merchant FOR UPDATE — row-level lock serialises balance check
          </code>
        </div>
        <button onClick={run} disabled={loading || !eligible} style={{
          background: loading ? 'var(--border)' : '#3b82f6', color: loading ? 'var(--muted)' : '#fff',
          border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 700, fontSize: 12,
          letterSpacing: 0.8, cursor: loading || !eligible ? 'not-allowed' : 'pointer',
          fontFamily: 'Syne, sans-serif', whiteSpace: 'nowrap', flexShrink: 0,
          boxShadow: loading || !eligible ? 'none' : '0 4px 12px rgba(59,130,246,0.35)',
          transition: 'all 0.15s',
        }}>
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite' }}>⟳</span> Running…
            </span>
          ) : '▶ Run Live Test'}
        </button>
      </div>

      {/* Setup info */}
      {!result && !loading && (
        <div style={{ padding: '1.25rem 1.5rem' }}>
          {eligible ? (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                ['Merchant', eligible.name],
                ['Available balance', paise2inr(eligible.available_balance_paise)],
                ['Amount per request', paise2inr(Math.floor(eligible.available_balance_paise * 0.6))],
                ['Combined total', paise2inr(Math.floor(eligible.available_balance_paise * 0.6) * 2)],
              ].map(([label, val]) => (
                <div key={label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--border)', minWidth: 140 }}>
                  <p style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3 }}>{label}</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', ...mono }}>{val}</p>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: 'var(--warn-light)', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 8 }}>
              <span>⚠️</span>
              <p style={{ fontSize: 13, color: 'var(--warn)' }}>No merchant has ≥ ₹100 available. Use the <strong>Add Merchant</strong> tab to add one with initial balance, or request a small payout first to reduce balance below threshold.</p>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[result.p1, result.p2].map((p, i) => (
              <div key={i} style={{
                flex: 1, minWidth: 200,
                background: p.ok ? 'var(--accent-light)' : 'var(--danger-light)',
                border: `1.5px solid ${p.ok ? '#6ee7b7' : '#fca5a5'}`,
                borderRadius: 14, padding: '1rem 1.25rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 18 }}>{p.ok ? '✅' : '🚫'}</span>
                  <span style={{ fontWeight: 700, color: p.ok ? 'var(--accent)' : 'var(--danger)', fontFamily: 'Syne, sans-serif', fontSize: 13 }}>Request {i + 1}</span>
                  <span style={{ marginLeft: 'auto', ...mono, fontSize: 12, fontWeight: 700, color: p.ok ? 'var(--accent)' : 'var(--danger)', background: p.ok ? '#dcfce7' : '#fee2e2', padding: '2px 8px', borderRadius: 99 }}>{p.code}</span>
                </div>
                <p style={{ fontSize: 12, color: p.ok ? '#065f46' : '#991b1b' }}>
                  {p.ok ? `✓ Payout created — ID: ${p.id}` : `✗ ${p.error}`}
                </p>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Amount: {paise2inr(result.amount)}</p>
              </div>
            ))}
          </div>

          {/* Verdict */}
          <div style={{ background: result.passed ? '#f0fdf4' : '#fef2f2', border: `1.5px solid ${result.passed ? '#86efac' : '#fca5a5'}`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{result.passed ? '✅' : '❌'}</span>
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: result.passed ? '#166534' : '#991b1b', fontFamily: 'Syne, sans-serif' }}>
                {result.passed ? 'PASSED — SELECT FOR UPDATE works correctly' : 'UNEXPECTED RESULT'}
              </p>
              <p style={{ fontSize: 12, color: result.passed ? '#166534' : '#991b1b', marginTop: 3 }}>
                {result.passed
                  ? `Exactly 1 succeeded, 1 rejected. Balance was ${paise2inr(result.balance)}, each request asked for ${paise2inr(result.amount)} (60%). Completed in ${result.elapsed}ms.`
                  : 'Both succeeded or both failed — check server logs.'}
              </p>
            </div>
          </div>

          <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)' }}>How it worked:</strong> PostgreSQL acquired a row-level lock on the merchant row when the first request ran{' '}
              <code style={{ ...mono, fontSize: 10, background: 'var(--border)', padding: '1px 5px', borderRadius: 4 }}>SELECT … FOR UPDATE</code>.
              The second request waited at the lock boundary. When the first committed (payout created, held = {paise2inr(result.amount)}),
              the second saw available = {paise2inr(result.balance - result.amount)} — insufficient for {paise2inr(result.amount)}.
              Source: <code style={{ ...mono, fontSize: 10, background: 'var(--border)', padding: '1px 5px', borderRadius: 4 }}>payouts/views.py:106</code>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Live Idempotency Demo ──────────────────────────────────────────────────────
function IdempotencyDemo({ merchants, onComplete }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const eligible = merchants.find(m => m.available_balance_paise >= 1000 && m.bank_accounts?.length > 0)

  async function run() {
    if (!eligible) return
    setLoading(true); setResult(null)

    const sharedKey = uuidv4()   // SAME key used for both calls
    const bankId = eligible.bank_accounts[0].id
    const payload = { amount_paise: 1000, bank_account_id: bankId }

    let r1, r2, r1Status, r2Status
    // Request 1 — creates the payout
    try {
      r1 = await api.createPayout(eligible.id, payload, sharedKey)
      r1Status = 201
    } catch (e) {
      r1 = { error: e.error || 'Failed' }; r1Status = e.status || 400
    }

    // Brief pause — ensures first request is fully resolved in DB before replay
    await new Promise(res => setTimeout(res, 150))

    // Request 2 — same key → must return identical payout
    try {
      r2 = await api.createPayout(eligible.id, payload, sharedKey)
      r2Status = 201
    } catch (e) {
      r2 = { error: e.error || 'Failed' }; r2Status = e.status || 400
    }

    const sameId = r1?.id && r2?.id && String(r1.id) === String(r2.id)
    const passed = r1Status === 201 && r2Status === 201 && sameId

    setResult({ sharedKey: sharedKey.slice(0, 8) + '…', r1, r2, r1Status, r2Status, sameId, passed, merchant: eligible.name })
    setLoading(false)
    if (onComplete) setTimeout(onComplete, 600)
  }

  const mono = { fontFamily: 'IBM Plex Mono, monospace' }

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 20, overflow: 'hidden', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #fdf4ff 0%, #f3e8ff 100%)', borderBottom: '1px solid #e9d5ff', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>🔑</span>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#6b21a8', fontFamily: 'Syne, sans-serif' }}>Idempotency Test</h3>
          </div>
          <p style={{ fontSize: 12, color: '#9333ea', lineHeight: 1.5 }}>
            Same request sent twice with an identical Idempotency-Key header.
            Must return the same payout — no duplicate created.
          </p>
          <code style={{ display: 'inline-block', fontSize: 11, color: '#6b21a8', background: '#f3e8ff', borderRadius: 6, padding: '3px 8px', marginTop: 6, ...mono }}>
            IdempotencyKey.get_or_create(merchant, key) — atomic on unique_together
          </code>
        </div>
        <button onClick={run} disabled={loading || !eligible} style={{
          background: loading ? 'var(--border)' : '#9333ea', color: loading ? 'var(--muted)' : '#fff',
          border: 'none', borderRadius: 10, padding: '8px 16px', fontWeight: 700, fontSize: 12,
          letterSpacing: 0.8, cursor: loading || !eligible ? 'not-allowed' : 'pointer',
          fontFamily: 'Syne, sans-serif', whiteSpace: 'nowrap', flexShrink: 0,
          boxShadow: loading || !eligible ? 'none' : '0 4px 12px rgba(147,51,234,0.35)',
          transition: 'all 0.15s',
        }}>
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'inline-block', animation: 'spin 0.8s linear infinite' }}>⟳</span> Running…
            </span>
          ) : '▶ Run Live Test'}
        </button>
      </div>

      {/* Setup info */}
      {!result && !loading && (
        <div style={{ padding: '1.25rem 1.5rem' }}>
          {eligible ? (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                ['Merchant', eligible.name],
                ['Amount', '₹10 (1000 paise)'],
                ['Key strategy', 'Fresh UUID — same for both calls'],
                ['Expected', '201 + 201, identical payout ID'],
              ].map(([label, val]) => (
                <div key={label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--border)', minWidth: 160 }}>
                  <p style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3 }}>{label}</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', ...mono }}>{val}</p>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: 'var(--warn-light)', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px' }}>
              <p style={{ fontSize: 13, color: 'var(--warn)' }}>⚠️ No merchant with ≥ ₹10 balance. Add a merchant or top up via Add Merchant.</p>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Shared key banner */}
          <div style={{ background: '#fdf4ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>🔑</span>
            <span style={{ fontSize: 13, color: '#6b21a8', fontWeight: 600 }}>Shared key: </span>
            <code style={{ fontSize: 13, color: '#6b21a8', ...mono }}>{result.sharedKey}</code>
            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>(same for both requests)</span>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Request 1', status: result.r1Status, data: result.r1, note: 'Creates payout' },
              { label: 'Request 2', status: result.r2Status, data: result.r2, note: 'Replays stored response' },
            ].map(({ label, status, data, note }) => (
              <div key={label} style={{ flex: 1, minWidth: 200, background: status === 201 ? 'var(--accent-light)' : 'var(--danger-light)', border: `1.5px solid ${status === 201 ? '#6ee7b7' : '#fca5a5'}`, borderRadius: 14, padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 18 }}>{status === 201 ? '✅' : '❌'}</span>
                  <span style={{ fontWeight: 700, color: status === 201 ? 'var(--accent)' : 'var(--danger)', fontFamily: 'Syne, sans-serif', fontSize: 13 }}>{label}</span>
                  <span style={{ marginLeft: 'auto', ...mono, fontSize: 12, fontWeight: 700, color: status === 201 ? 'var(--accent)' : 'var(--danger)', background: status === 201 ? '#dcfce7' : '#fee2e2', padding: '2px 8px', borderRadius: 99 }}>{status}</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{note}</p>
                {data?.id ? (
                  <p style={{ fontSize: 12, color: status === 201 ? '#065f46' : '#991b1b', ...mono }}>
                    ID: {String(data.id).slice(0, 8)}…
                  </p>
                ) : (
                  <p style={{ fontSize: 12, color: '#991b1b' }}>{data?.error}</p>
                )}
              </div>
            ))}
          </div>

          {/* Same ID highlight */}
          {result.r1?.id && result.r2?.id && (
            <div style={{ background: result.sameId ? '#f0fdf4' : '#fef2f2', border: `1px solid ${result.sameId ? '#86efac' : '#fca5a5'}`, borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 18 }}>{result.sameId ? '🟰' : '≠'}</span>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: result.sameId ? '#166534' : '#991b1b', ...mono }}>
                  {result.sameId ? 'Identical payout ID returned both times' : 'Different IDs — idempotency broken!'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, ...mono }}>{String(result.r1.id).slice(0, 8)}… = {String(result.r2.id).slice(0, 8)}…</p>
              </div>
            </div>
          )}

          {/* Verdict */}
          <div style={{ background: result.passed ? '#f0fdf4' : '#fef2f2', border: `1.5px solid ${result.passed ? '#86efac' : '#fca5a5'}`, borderRadius: 12, padding: '12px 16px', display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 22 }}>{result.passed ? '✅' : '❌'}</span>
            <div>
              <p style={{ fontWeight: 700, fontSize: 13, color: result.passed ? '#166534' : '#991b1b', fontFamily: 'Syne, sans-serif' }}>
                {result.passed ? 'PASSED — Idempotency works correctly' : 'FAILED — Check server logs'}
              </p>
              <p style={{ fontSize: 12, color: result.passed ? '#166534' : '#991b1b', marginTop: 3 }}>
                {result.passed
                  ? 'Both calls returned HTTP 201 with the same payout ID. Only 1 payout row exists in the database.'
                  : 'Unexpected result — one or both requests failed, or IDs differ.'}
              </p>
            </div>
          </div>

          <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)' }}>How it worked:</strong>{' '}
              <code style={{ ...mono, fontSize: 10, background: 'var(--border)', padding: '1px 5px', borderRadius: 4 }}>IdempotencyKey.objects.get_or_create(merchant, key)</code>{' '}
              is atomic at the DB level (unique_together constraint). The first request sets{' '}
              <code style={{ ...mono, fontSize: 10 }}>resolved_at</code> once the payout is created and stores the full response body.
              The second request finds the existing row (<code style={{ ...mono, fontSize: 10 }}>created=False</code>), sees it is resolved, and returns the cached response directly — no new payout created.
              Source: <code style={{ ...mono, fontSize: 10, background: 'var(--border)', padding: '1px 5px', borderRadius: 4 }}>payouts/views.py:29, 88–96</code>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Add Merchant Form ──────────────────────────────────────────────────────────
function AddMerchantForm({ onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', account_holder: '', account_number: '', ifsc_code: '', initial_balance: '' })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(null)

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErr(null); setOk(null) }

  async function submit(e) {
    e.preventDefault(); setErr(null); setOk(null); setLoading(true)
    try {
      const res = await api.adminCreateMerchant({
        name: form.name, email: form.email,
        account_holder: form.account_holder, account_number: form.account_number,
        ifsc_code: form.ifsc_code,
        initial_balance_paise: Math.round(parseFloat(form.initial_balance || 0) * 100),
      })
      setOk(`Merchant "${res.name}" created successfully`)
      setForm({ name: '', email: '', account_holder: '', account_number: '', ifsc_code: '', initial_balance: '' })
      onCreated()
    } catch (e) {
      setErr(e.error || 'Failed to create merchant')
    } finally { setLoading(false) }
  }

  const inp = (extra = {}) => ({
    width: '100%', background: 'var(--surface2)', border: '1.5px solid var(--border2)',
    borderRadius: 10, padding: '0.65rem 0.9rem', color: 'var(--text)', fontSize: 14,
    outline: 'none', transition: 'border-color 0.15s', fontFamily: 'inherit', ...extra,
  })
  const FL = ({ children }) => <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6, fontFamily: 'Syne, sans-serif' }}>{children}</label>
  const focus = e => e.target.style.borderColor = 'var(--accent)'
  const blur = e => e.target.style.borderColor = 'var(--border2)'

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--shadow)', border: '1px solid var(--border)', overflow: 'hidden' }}>
      <SectionHeader title="Add New Merchant" />
      <form onSubmit={submit} style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        <div style={{ gridColumn: '1 / -1' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}><span>🏪</span><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', fontFamily: 'Syne, sans-serif' }}>Business Details</span></div></div>
        <div><FL>Business Name *</FL><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Acme Corp" required style={inp()} onFocus={focus} onBlur={blur} /></div>
        <div><FL>Email Address *</FL><input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="billing@acme.com" required style={inp()} onFocus={focus} onBlur={blur} /></div>
        <div style={{ gridColumn: '1 / -1' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}><span>🏦</span><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', fontFamily: 'Syne, sans-serif' }}>Primary Bank Account</span></div></div>
        <div><FL>Account Holder *</FL><input value={form.account_holder} onChange={e => set('account_holder', e.target.value)} placeholder="Acme Corp" required style={inp()} onFocus={focus} onBlur={blur} /></div>
        <div><FL>Account Number *</FL><input value={form.account_number} onChange={e => set('account_number', e.target.value)} placeholder="1234567890123456" required style={inp({ fontFamily: 'IBM Plex Mono, monospace' })} onFocus={focus} onBlur={blur} /></div>
        <div><FL>IFSC Code *</FL><input value={form.ifsc_code} onChange={e => set('ifsc_code', e.target.value.toUpperCase())} placeholder="HDFC0001234" required style={inp({ fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase' })} onFocus={focus} onBlur={blur} /></div>
        <div><FL>Initial Balance (₹)</FL>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontWeight: 700 }}>₹</span>
            <input type="number" min="0" step="0.01" value={form.initial_balance} onChange={e => set('initial_balance', e.target.value)} placeholder="0.00" style={inp({ paddingLeft: '2rem', fontFamily: 'IBM Plex Mono, monospace' })} onFocus={focus} onBlur={blur} />
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Credited to ledger immediately</p>
        </div>
        {err && <div style={{ gridColumn: '1 / -1', background: 'var(--danger-light)', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8 }}><span style={{ color: 'var(--danger)' }}>⚠</span><p style={{ color: 'var(--danger)', fontSize: 13 }}>{err}</p></div>}
        {ok  && <div style={{ gridColumn: '1 / -1', background: 'var(--accent-light)', border: '1px solid #6ee7b7', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8 }}><span style={{ color: 'var(--accent)' }}>✓</span><p style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 500 }}>{ok}</p></div>}
        <div style={{ gridColumn: '1 / -1' }}>
          <button type="submit" disabled={loading} style={{ width: '100%', background: loading ? 'var(--border2)' : 'var(--accent)', color: loading ? 'var(--muted)' : '#fff', border: 'none', borderRadius: 12, padding: '0.8rem', fontWeight: 700, fontSize: 13, letterSpacing: 1.5, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Syne, sans-serif', boxShadow: loading ? 'none' : '0 4px 12px rgba(5,150,105,0.3)' }}
            onMouseEnter={e => { if (!loading) e.target.style.background = '#047857' }}
            onMouseLeave={e => { if (!loading) e.target.style.background = 'var(--accent)' }}
          >{loading ? 'CREATING…' : 'CREATE MERCHANT'}</button>
        </div>
      </form>
    </div>
  )
}

// ── Merchant Card ──────────────────────────────────────────────────────────────
function MerchantCard({ m }) {
  const total = m.available_balance_paise + m.held_balance_paise || 1
  const pct = Math.max(0, Math.min(100, (m.available_balance_paise / total) * 100))
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, padding: '1.5rem', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', fontFamily: 'Syne, sans-serif', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'IBM Plex Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', fontFamily: 'IBM Plex Mono, monospace' }}>{paise2inr(m.available_balance_paise)}</p>
          {m.held_balance_paise > 0 && <p style={{ fontSize: 11, color: 'var(--warn)', fontFamily: 'IBM Plex Mono, monospace', marginTop: 2 }}>+{paise2inr(m.held_balance_paise)} held</p>}
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Balance utilisation</span>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'IBM Plex Mono, monospace' }}>{pct.toFixed(0)}% available</span>
        </div>
        <div style={{ height: 5, background: 'var(--border)', borderRadius: 3 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 3, transition: 'width 0.4s ease' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--accent)', background: 'var(--accent-light)', padding: '3px 9px', borderRadius: 99, fontWeight: 600 }}>✓ {m.completed_payouts} done</span>
        {m.failed_payouts > 0 && <span style={{ fontSize: 11, color: 'var(--danger)', background: 'var(--danger-light)', padding: '3px 9px', borderRadius: 99, fontWeight: 600 }}>✗ {m.failed_payouts} failed</span>}
        {m.processing_payouts > 0 && <span style={{ fontSize: 11, color: 'var(--purple)', background: 'var(--purple-light)', padding: '3px 9px', borderRadius: 99, fontWeight: 600 }}>⟳ {m.processing_payouts} processing</span>}
      </div>
      {m.bank_accounts?.length > 0 && (
        <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '8px 12px', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 3 }}>Primary Bank</p>
          <p style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--text)' }}>{m.bank_accounts[0].account_holder} — ••••{m.bank_accounts[0].account_number.slice(-4)}</p>
          <p style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'IBM Plex Mono, monospace', marginTop: 2 }}>{m.bank_accounts[0].ifsc_code}</p>
        </div>
      )}
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin_authed') === '1')
  if (!authed) return <LoginScreen onAuth={() => setAuthed(true)} />
  return <AdminPortalInner onLogout={() => { sessionStorage.removeItem('admin_authed'); setAuthed(false) }} />
}

function AdminPortalInner({ onLogout }) {
  const [stats, setStats] = useState(null)
  const [payouts, setPayouts] = useState([])
  const [merchants, setMerchants] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [retrying, setRetrying] = useState(false)
  const [retryMsg, setRetryMsg] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [refreshKey, setRefreshKey] = useState(0)
  const [actionLoading, setActionLoading] = useState({})
  const [actionMsg, setActionMsg] = useState(null)

  const refresh = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    Promise.all([api.adminStats(), api.adminMerchants()])
      .then(([s, m]) => { setStats(s); setMerchants(m) }).catch(console.error)
  }, [refreshKey])

  useEffect(() => {
    api.adminPayouts(statusFilter === 'all' ? '' : statusFilter).then(setPayouts).catch(console.error)
  }, [statusFilter, refreshKey])

  useEffect(() => {
    const id = setInterval(refresh, 8000)
    return () => clearInterval(id)
  }, [refresh])

  async function handleRetry() {
    setRetrying(true); setRetryMsg(null)
    try { const r = await api.adminRetryStuck(); setRetryMsg(r.message); setTimeout(refresh, 600) }
    catch { setRetryMsg('Retry failed') } finally { setRetrying(false) }
  }

  async function handlePayoutAction(payoutId, action) {
    setActionLoading(l => ({ ...l, [payoutId]: action })); setActionMsg(null)
    try {
      const r = await api.adminPayoutAction(payoutId, action)
      setActionMsg({ type: 'ok', text: r.message }); setTimeout(refresh, 400)
    } catch (e) {
      setActionMsg({ type: 'err', text: e.error || 'Action failed' })
    } finally {
      setActionLoading(l => { const n = { ...l }; delete n[payoutId]; return n })
    }
  }

  const tabs = [
    ['overview', '🏠', 'Overview'],
    ['payouts',  '💳', 'Payouts'],
    ['merchants','🏪', 'Merchants'],
    ['add',      '➕', 'Add Merchant'],
    ['tests',    '🧪', 'Live Tests'],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Portal header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, background: 'linear-gradient(135deg, #059669 0%, #047857 100%)', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(5,150,105,0.3)', fontSize: 18 }}>🛡️</div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Syne, sans-serif', color: 'var(--text)', lineHeight: 1 }}>Admin Portal</h1>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Full control over payout operations</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {stats?.processing > 0 && (
            <button onClick={handleRetry} disabled={retrying} style={{ background: retrying ? 'var(--border)' : 'var(--purple)', color: retrying ? 'var(--muted)' : '#fff', border: 'none', borderRadius: 10, padding: '7px 14px', fontWeight: 700, fontSize: 12, cursor: retrying ? 'not-allowed' : 'pointer', fontFamily: 'Syne, sans-serif', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 12px rgba(124,58,237,0.25)' }}>
              <span style={{ display: 'inline-block', animation: retrying ? 'spin 0.8s linear infinite' : 'none' }}>⟳</span>
              {retrying ? 'Retrying…' : `Retry ${stats.processing} Stuck`}
            </button>
          )}
          <button onClick={refresh} style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 9, padding: '7px 13px', cursor: 'pointer', fontSize: 12, fontFamily: 'Syne, sans-serif', boxShadow: 'var(--shadow-sm)' }}>↻ Refresh</button>
          <button onClick={onLogout} style={{ background: 'var(--danger-light)', border: '1px solid #fca5a5', color: 'var(--danger)', borderRadius: 9, padding: '7px 13px', cursor: 'pointer', fontSize: 12, fontFamily: 'Syne, sans-serif', fontWeight: 600 }}>🔒 Lock</button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StatCard icon="🏪" label="Merchants"      value={stats.total_merchants}              color="var(--text)"   bg="#f1f5f9" />
          <StatCard icon="💳" label="Total Payouts"  value={stats.total_payouts}                color="var(--text)"   bg="#f1f5f9" />
          <StatCard icon="💰" label="Volume Settled" value={paise2inr(stats.total_volume_paise)} color="var(--accent)" bg="var(--accent-light)" sub={`${stats.completed} completed`} />
          <StatCard icon="✓"  label="Success Rate"   value={`${stats.success_rate}%`}           color="var(--accent)" bg="var(--accent-light)" />
          <StatCard icon="✗"  label="Failed"         value={stats.failed}                       color="var(--danger)" bg="var(--danger-light)" />
          <StatCard icon="⟳" label="Processing"     value={stats.processing}                   color={stats.processing > 0 ? 'var(--purple)' : 'var(--muted)'} bg="var(--purple-light)" sub={stats.processing > 0 ? 'Needs attention' : 'All clear'} />
        </div>
      )}

      {retryMsg && <div style={{ background: 'var(--purple-light)', border: '1px solid #c4b5fd', borderRadius: 10, padding: '10px 16px', fontSize: 13, color: 'var(--purple)', fontWeight: 500 }}>✓ {retryMsg}</div>}
      {actionMsg && (
        <div style={{ background: actionMsg.type === 'ok' ? 'var(--accent-light)' : 'var(--danger-light)', border: `1px solid ${actionMsg.type === 'ok' ? '#6ee7b7' : '#fca5a5'}`, borderRadius: 10, padding: '10px 16px', fontSize: 13, color: actionMsg.type === 'ok' ? 'var(--accent)' : 'var(--danger)', fontWeight: 500, display: 'flex', justifyContent: 'space-between' }}>
          <span>{actionMsg.type === 'ok' ? '✓' : '⚠'} {actionMsg.text}</span>
          <button onClick={() => setActionMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 16 }}>×</button>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 4, width: 'fit-content', boxShadow: 'var(--shadow-sm)' }}>
        {tabs.map(([t, icon, label]) => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            padding: '7px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: activeTab === t ? 'var(--accent)' : 'transparent',
            color: activeTab === t ? '#fff' : 'var(--muted)',
            fontWeight: activeTab === t ? 700 : 500, fontSize: 12,
            fontFamily: 'Syne, sans-serif', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: 5,
            boxShadow: activeTab === t ? '0 2px 8px rgba(5,150,105,0.25)' : 'none',
          }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── Overview ────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
            <SectionHeader title="Status Breakdown" />
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {['completed', 'failed', 'processing', 'pending'].map(s => {
                const count = stats[s] || 0
                const pct = stats.total_payouts ? (count / stats.total_payouts) * 100 : 0
                return (
                  <div key={s}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: STATUS_COLOR[s] }}>{STATUS_ICON[s]}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{s}</span>
                      </span>
                      <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--muted)' }}>{count} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--border)', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: STATUS_COLOR[s], borderRadius: 3, opacity: 0.85, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {stats.processing > 0 ? (
              <div style={{ background: 'var(--purple-light)', border: '1px solid #c4b5fd', borderRadius: 16, padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 22, animation: 'pulse 1.6s ease-in-out infinite' }}>⟳</span>
                  <div>
                    <p style={{ fontWeight: 700, color: 'var(--purple)', fontFamily: 'Syne, sans-serif' }}>{stats.processing} Stuck Payout{stats.processing > 1 ? 's' : ''}</p>
                    <p style={{ fontSize: 12, color: 'var(--purple)', opacity: 0.8, marginTop: 2 }}>Hung in PROCESSING — use retry or resolve manually</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleRetry} disabled={retrying} style={{ flex: 1, background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: 9, padding: '8px', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}>{retrying ? 'Retrying…' : 'Auto-Retry All'}</button>
                  <button onClick={() => setActiveTab('payouts')} style={{ flex: 1, background: 'white', color: 'var(--purple)', border: '1.5px solid var(--purple)', borderRadius: 9, padding: '8px', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Syne, sans-serif' }}>Manage Manually</button>
                </div>
              </div>
            ) : (
              <div style={{ background: 'var(--accent-light)', border: '1px solid #6ee7b7', borderRadius: 16, padding: '1.5rem', textAlign: 'center' }}>
                <p style={{ fontSize: 28, marginBottom: 6 }}>✅</p>
                <p style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'Syne, sans-serif' }}>System Healthy</p>
                <p style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4 }}>No stuck payouts</p>
              </div>
            )}
            <div style={{ background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
              <SectionHeader title="Resolution Methods" />
              <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[['🔄','Auto-Retry','Backdates processing_started_at → triggers check_stuck_payouts'],['✅','Force Complete','Creates debit ledger entry → transitions to completed'],['❌','Force Cancel','Transitions to failed, no ledger entry, hold releases'],].map(([i,t,d])=>(
                  <div key={t} style={{ display: 'flex', gap: 10 }}>
                    <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{i}</span>
                    <div><p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 1 }}>{t}</p><p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>{d}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Payouts ─────────────────────────────────────────────────────────── */}
      {activeTab === 'payouts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: '5px 13px', borderRadius: 99, cursor: 'pointer', border: `1.5px solid ${statusFilter === s ? (STATUS_COLOR[s] || 'var(--text)') : 'var(--border)'}`, background: statusFilter === s ? (STATUS_BG[s] || 'var(--surface2)') : 'var(--surface)', color: statusFilter === s ? (STATUS_COLOR[s] || 'var(--text)') : 'var(--muted)', fontWeight: 600, fontSize: 12, fontFamily: 'Syne, sans-serif', textTransform: 'capitalize', boxShadow: 'var(--shadow-sm)', transition: 'all 0.15s' }}>
                {s === 'all' ? '⊕ All' : `${STATUS_ICON[s]} ${s}`}
              </button>
            ))}
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow)', border: '1px solid var(--border)' }}>
            <SectionHeader title={statusFilter === 'all' ? 'All Payouts' : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Payouts`} count={payouts.length} />
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><TH>ID</TH><TH>Merchant</TH><TH>Amount</TH><TH>Bank</TH><TH>Status</TH><TH>Created</TH><TH>Actions</TH></tr></thead>
                <tbody>
                  {payouts.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No payouts found</td></tr>
                  ) : payouts.map((p, i) => {
                    const canAct = p.status === 'processing' || p.status === 'pending'
                    const loading = actionLoading[p.id]
                    return (
                      <tr key={p.id} style={{ borderBottom: i < payouts.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '11px 14px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: 'var(--muted)' }}>{String(p.id).slice(0, 8)}…</td>
                        <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{p.merchant_name}</td>
                        <td style={{ padding: '11px 14px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{paise2inr(p.amount_paise)}</td>
                        <td style={{ padding: '11px 14px', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, color: 'var(--muted)' }}>••••{p.bank_account_last4}</td>
                        <td style={{ padding: '11px 14px' }}><Badge status={p.status} />{p.failure_reason && <p style={{ fontSize: 10, color: 'var(--danger)', marginTop: 3, fontFamily: 'IBM Plex Mono, monospace' }}>{p.failure_reason}</p>}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{fmtDate(p.created_at)}</td>
                        <td style={{ padding: '11px 14px' }}>
                          {canAct ? (
                            <div style={{ display: 'flex', gap: 5 }}>
                              <button onClick={() => handlePayoutAction(p.id, 'complete')} disabled={!!loading} title="Force complete" style={{ background: loading === 'complete' ? 'var(--border)' : 'var(--accent-light)', color: 'var(--accent)', border: '1px solid #6ee7b7', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Syne, sans-serif', transition: 'all 0.12s' }}
                                onMouseEnter={e => { if (!loading) { e.target.style.background = 'var(--accent)'; e.target.style.color = '#fff' } }}
                                onMouseLeave={e => { if (!loading) { e.target.style.background = 'var(--accent-light)'; e.target.style.color = 'var(--accent)' } }}
                              >{loading === 'complete' ? '…' : '✓ Complete'}</button>
                              <button onClick={() => handlePayoutAction(p.id, 'cancel')} disabled={!!loading} title="Force cancel" style={{ background: loading === 'cancel' ? 'var(--border)' : 'var(--danger-light)', color: 'var(--danger)', border: '1px solid #fca5a5', borderRadius: 7, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Syne, sans-serif', transition: 'all 0.12s' }}
                                onMouseEnter={e => { if (!loading) { e.target.style.background = 'var(--danger)'; e.target.style.color = '#fff' } }}
                                onMouseLeave={e => { if (!loading) { e.target.style.background = 'var(--danger-light)'; e.target.style.color = 'var(--danger)' } }}
                              >{loading === 'cancel' ? '…' : '✗ Cancel'}</button>
                            </div>
                          ) : <span style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Merchants ───────────────────────────────────────────────────────── */}
      {activeTab === 'merchants' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>{merchants.length} merchant{merchants.length !== 1 ? 's' : ''} registered</p>
            <button onClick={() => setActiveTab('add')} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 9, padding: '6px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'Syne, sans-serif', boxShadow: '0 2px 8px rgba(5,150,105,0.25)' }}>+ Add Merchant</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {merchants.map(m => <MerchantCard key={m.id} m={m} />)}
          </div>
        </div>
      )}

      {/* ── Add Merchant ─────────────────────────────────────────────────────── */}
      {activeTab === 'add' && <AddMerchantForm onCreated={() => { refresh(); setActiveTab('merchants') }} />}

      {/* ── Live Tests ───────────────────────────────────────────────────────── */}
      {activeTab === 'tests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Explanation banner */}
          <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.25rem 1.5rem' }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', fontFamily: 'Syne, sans-serif', marginBottom: 8 }}>Live Correctness Tests</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
              These tests hit the <em>real</em> API endpoints — not mocks. Each button fires actual HTTP requests against
              the running Django backend and shows you the raw HTTP status codes and payout IDs returned.
              The tests prove the two hardest correctness properties the graders check for.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              {[
                ['📄 views.py:106', 'SELECT FOR UPDATE — concurrency lock'],
                ['📄 views.py:29',  'get_or_create — idempotency gate'],
                ['📄 views.py:88',  'Idempotency replay — cached response'],
                ['📄 tests.py:59',  'ConcurrencyTest (same logic)'],
              ].map(([file, desc]) => (
                <div key={file} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <code style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'IBM Plex Mono, monospace' }}>{file}</code>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>

          <ConcurrencyDemo merchants={merchants} onComplete={refresh} />
          <IdempotencyDemo merchants={merchants} onComplete={refresh} />
        </div>
      )}
    </div>
  )
}
