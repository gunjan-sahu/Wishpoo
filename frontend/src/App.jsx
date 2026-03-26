import { useState, useEffect, useRef } from 'react'
import {
  connectWallet, makeWish, grantWish, claimWish,
  getWish, getRecentIds, getWishCount,
  xlm, short, CONTRACT_ID,
} from './lib/stellar'

// ── Stars background ────────────────────────────────────────────────────────
function Stars() {
  const stars = useRef(
    Array.from({ length: 80 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2.5 + 0.5,
      delay: Math.random() * 4,
      dur: 2.5 + Math.random() * 3,
    }))
  )
  return (
    <div className="stars" aria-hidden>
      {stars.current.map(s => (
        <div key={s.id} className="star" style={{
          left: `${s.x}%`,
          top: `${s.y}%`,
          width: `${s.size}px`,
          height: `${s.size}px`,
          animationDelay: `${s.delay}s`,
          animationDuration: `${s.dur}s`,
        }} />
      ))}
    </div>
  )
}

// ── Wish progress arc ─────────────────────────────────────────────────────
function ProgressArc({ pool, target, size = 56 }) {
  const pct = target > 0 ? Math.min(1, Number(pool) / Number(target)) : 0
  const r = size / 2 - 5
  const circ = 2 * Math.PI * r
  const dash = pct * circ
  const color = pct >= 1 ? '#fbbf24' : '#a78bfa'
  return (
    <svg width={size} height={size} className="arc-svg">
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease', filter: `drop-shadow(0 0 4px ${color})` }}
      />
      <text x="50%" y="54%" textAnchor="middle" className="arc-pct"
        style={{ fill: color }}>
        {Math.round(pct * 100)}%
      </text>
    </svg>
  )
}

// ── Status pill ────────────────────────────────────────────────────────────
function StatusPill({ status }) {
  const map = {
    Open:      { label: '✦ Open',      cls: 'pill-open'      },
    Fulfilled: { label: '★ Fulfilled', cls: 'pill-fulfilled' },
    Withdrawn: { label: '✓ Claimed',   cls: 'pill-withdrawn' },
  }
  const s = map[status] || { label: status, cls: '' }
  return <span className={`pill ${s.cls}`}>{s.label}</span>
}

// ── Wish card ──────────────────────────────────────────────────────────────
function WishCard({ wish, wallet, onAction }) {
  const [grantAmt, setGrantAmt] = useState('0.5')
  const [showGrant, setShowGrant] = useState(false)
  const [busy, setBusy] = useState(false)

  const isWisher = wallet && wish.wisher?.toString() === wallet
  const canClaim = isWisher && (wish.status === 'Fulfilled' || wish.status === 'Open') && Number(wish.pool) > 0
  const canGrant = wish.status === 'Open'
  const pct = wish.target > 0 ? Math.min(100, (Number(wish.pool) / Number(wish.target)) * 100) : 0

  const handle = async (fn, label) => {
    setBusy(true)
    try {
      const hash = await fn()
      onAction({ ok: true, msg: label, hash })
      setShowGrant(false)
    } catch (e) { onAction({ ok: false, msg: e.message }) }
    finally { setBusy(false) }
  }

  return (
    <div className={`wish-card ${wish.status === 'Fulfilled' ? 'card-fulfilled' : ''} ${wish.status === 'Withdrawn' ? 'card-withdrawn' : ''}`}>
      {/* Sparkle corner */}
      {wish.status === 'Fulfilled' && <div className="sparkle-corner">✦</div>}

      <div className="wc-top">
        <div className="wc-left">
          <div className="wc-id">wish #{wish.id?.toString()}</div>
          <StatusPill status={wish.status} />
        </div>
        <ProgressArc pool={wish.pool} target={wish.target} />
      </div>

      <p className="wc-text">"{wish.text}"</p>

      <div className="wc-stats">
        <div className="ws-item">
          <span className="ws-val">{xlm(wish.pool)} XLM</span>
          <span className="ws-label">pooled</span>
        </div>
        <div className="ws-sep">of</div>
        <div className="ws-item">
          <span className="ws-val">{xlm(wish.target)} XLM</span>
          <span className="ws-label">goal</span>
        </div>
        <div className="ws-sep">·</div>
        <div className="ws-item">
          <span className="ws-val">{wish.grant_count?.toString()}</span>
          <span className="ws-label">granters</span>
        </div>
        <div className="ws-sep">·</div>
        <div className="ws-item">
          <span className="ws-val">{short(wish.wisher)}</span>
          <span className="ws-label">wisher</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="wc-bar-wrap">
        <div className="wc-bar">
          <div className="wc-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Actions */}
      {wallet && (
        <div className="wc-actions">
          {canGrant && (
            <button
              className={`btn-grant-toggle ${showGrant ? 'active' : ''}`}
              onClick={() => setShowGrant(g => !g)}
            >
              ✦ Grant XLM
            </button>
          )}
          {canClaim && (
            <button
              className="btn-claim-wish"
              disabled={busy}
              onClick={() => handle(() => claimWish(wallet, wish.id), `Wish #${wish.id} claimed!`)}
            >
              {busy ? 'Signing…' : `Claim ${xlm(wish.pool)} XLM`}
            </button>
          )}
        </div>
      )}

      {showGrant && canGrant && (
        <div className="grant-panel">
          <div className="gp-label">How much to grant?</div>
          <div className="gp-row">
            {['0.1','0.5','1','2','5'].map(v => (
              <button
                key={v}
                className={`gp-preset ${grantAmt === v ? 'gp-active' : ''}`}
                onClick={() => setGrantAmt(v)}
              >{v}</button>
            ))}
            <input
              className="gp-custom"
              type="number" min="0.05" step="0.05"
              value={grantAmt}
              onChange={e => setGrantAmt(e.target.value)}
            />
            <span className="gp-unit">XLM</span>
          </div>
          <button
            className="btn-grant-confirm"
            disabled={busy}
            onClick={() => handle(
              () => grantWish(wallet, wish.id, parseFloat(grantAmt)),
              `Granted ${grantAmt} XLM to wish #${wish.id}`
            )}
          >
            {busy ? 'Granting…' : `✦ Grant ${grantAmt} XLM`}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Make wish form ─────────────────────────────────────────────────────────
function MakeWishForm({ wallet, onWished }) {
  const [text,   setText]   = useState('')
  const [target, setTarget] = useState('10')
  const [seed,   setSeed]   = useState('1')
  const [busy,   setBusy]   = useState(false)
  const [err,    setErr]    = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!wallet) return
    setBusy(true); setErr('')
    try {
      const hash = await makeWish(wallet, text, parseFloat(target), parseFloat(seed))
      onWished(hash)
      setText(''); setTarget('10'); setSeed('1')
    } catch (e) { setErr(e.message) }
    finally { setBusy(false) }
  }

  return (
    <form className="wish-form" onSubmit={handleSubmit}>
      <div className="wf-title">Make a Wish</div>

      <div className="wf-field">
        <label>Your wish</label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="I wish for…"
          maxLength={160}
          rows={3}
          required
          disabled={!wallet || busy}
        />
        <span className="wf-chars">{text.length}/160</span>
      </div>

      <div className="wf-row">
        <div className="wf-field">
          <label>XLM goal</label>
          <input type="number" min="0.1" step="0.1"
            value={target} onChange={e => setTarget(e.target.value)}
            required disabled={!wallet || busy} />
        </div>
        <div className="wf-field">
          <label>Seed amount</label>
          <input type="number" min="0.1" step="0.1"
            value={seed} onChange={e => setSeed(e.target.value)}
            required disabled={!wallet || busy} />
        </div>
      </div>

      <div className="wf-hint">
        Seed must be ≤ goal · Anyone can grant XLM to help fulfill your wish
      </div>

      {err && <p className="wf-err">{err}</p>}

      <button type="submit" className="btn-wish" disabled={!wallet || busy || !text}>
        {!wallet ? 'Connect wallet to wish' : busy ? 'Sealing wish…' : '✦ Seal This Wish'}
      </button>
    </form>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function App() {
  const [wallet,     setWallet]     = useState(null)
  const [wishes,     setWishes]     = useState([])
  const [wishCount,  setWishCount]  = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState('board')
  const [toast,      setToast]      = useState(null)

  const loadWishes = async () => {
    setLoading(true)
    try {
      const [ids, count] = await Promise.all([getRecentIds(), getWishCount()])
      setWishCount(count)
      const loaded = await Promise.allSettled(ids.map(id => getWish(id)))
      setWishes(loaded.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadWishes() }, [])

  const handleConnect = async () => {
    try { setWallet(await connectWallet()) }
    catch (e) { showToast(false, e.message) }
  }

  const showToast = (ok, msg, hash) => {
    setToast({ ok, msg, hash })
    setTimeout(() => setToast(null), 6000)
  }

  const handleAction = ({ ok, msg, hash }) => {
    showToast(ok, msg, hash)
    if (ok) loadWishes()
  }

  const handleWished = (hash) => {
    showToast(true, 'Your wish has been sealed on-chain!', hash)
    setTab('board')
    loadWishes()
  }

  const fulfilled = wishes.filter(w => w.status === 'Fulfilled').length
  const totalPooled = wishes.reduce((s, w) => s + Number(w.pool), 0)

  return (
    <div className="app">
      <Stars />

      {/* ── Header ── */}
      <header className="header">
        <div className="brand">
          <span className="brand-star">✦</span>
          <span className="brand-name">WishPool</span>
        </div>

        <nav className="nav">
          <button className={`nav-btn ${tab === 'board' ? 'nav-active' : ''}`} onClick={() => setTab('board')}>The Board</button>
          <button className={`nav-btn ${tab === 'wish' ? 'nav-active' : ''}`} onClick={() => setTab('wish')}>Make a Wish</button>
        </nav>

        <div className="header-right">
          {wallet
            ? <div className="wallet-tag"><span className="wdot" />{short(wallet)}</div>
            : <button className="btn-connect" onClick={handleConnect}>Connect Wallet</button>
          }
        </div>
      </header>

      {/* ── Marquee stats ── */}
      <div className="marquee-wrap">
        <div className="marquee-track">
          {[
            `${wishCount} wishes made`,
            `${fulfilled} fulfilled`,
            `${(totalPooled / 10_000_000).toFixed(1)} XLM pooled`,
            'Stellar testnet',
            'grant any wish',
            `${wishCount} wishes made`,
            `${fulfilled} fulfilled`,
            `${(totalPooled / 10_000_000).toFixed(1)} XLM pooled`,
            'Stellar testnet',
            'grant any wish',
          ].map((item, i) => (
            <span key={i} className="marquee-item">{item} <span className="mq-sep">✦</span> </span>
          ))}
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={`toast ${toast.ok ? 'toast-ok' : 'toast-err'}`}>
          <span>{toast.msg}</span>
          {toast.hash && (
            <a href={`https://stellar.expert/explorer/testnet/tx/${toast.hash}`}
              target="_blank" rel="noreferrer" className="toast-link">tx ↗</a>
          )}
        </div>
      )}

      {/* ── Body ── */}
      <main className="main">
        {tab === 'wish' && (
          <div className="wish-form-wrap">
            <MakeWishForm wallet={wallet} onWished={handleWished} />
          </div>
        )}

        {tab === 'board' && (
          <div className="board">
            <div className="board-header">
              <h2 className="board-title">The Wishing Board</h2>
              <button className="btn-refresh" onClick={loadWishes}>↻ Refresh</button>
            </div>

            {loading ? (
              <div className="loading-grid">
                {[1,2,3].map(i => <div key={i} className="wish-skeleton" />)}
              </div>
            ) : wishes.length === 0 ? (
              <div className="board-empty">
                <div className="be-star">✦</div>
                <p className="be-title">No wishes yet.</p>
                <p className="be-sub">Be the first to make one.</p>
                <button className="btn-make-first" onClick={() => setTab('wish')}>Make the first wish</button>
              </div>
            ) : (
              <div className="wish-grid">
                {wishes.map(w => (
                  <WishCard
                    key={w.id?.toString()}
                    wish={w}
                    wallet={wallet}
                    onAction={handleAction}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="footer">
        <span>WishPool · Stellar Soroban · Testnet</span>
        <a href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
          target="_blank" rel="noreferrer">Contract ↗</a>
      </footer>
    </div>
  )
}
