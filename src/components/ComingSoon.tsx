'use client'

import { useState, useEffect, useRef } from 'react'
import styles from './ComingSoon.module.css'

export default function ComingSoon() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Typewriter state
  const [displayText, setDisplayText] = useState('')
  const [showCursor, setShowCursor] = useState(true)
  const typewriterDone = useRef(false)

  const fullText = 'AI agents\nare hiring.'

  useEffect(() => {
    if (typewriterDone.current) return
    let i = 0
    const timer = setInterval(() => {
      i++
      setDisplayText(fullText.slice(0, i))
      if (i >= fullText.length) {
        clearInterval(timer)
        typewriterDone.current = true
      }
    }, 65)
    return () => clearInterval(timer)
  }, [])

  // Blinking cursor
  useEffect(() => {
    const timer = setInterval(() => setShowCursor(c => !c), 530)
    return () => clearInterval(timer)
  }, [])

  const handleSubmit = async () => {
    if (!email || !email.includes('@')) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Network error — try again')
    } finally {
      setLoading(false)
    }
  }

  // Split display text into lines for rendering
  const lines = displayText.split('\n')

  return (
    <div className={styles.wrap}>
      <div className={styles.grid} />
      <div className={styles.scanlines} />
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={styles.logo}>Carbon Contractors</div>
          <div className={styles.status}>
            <div className={styles.dot} />
            Building
          </div>
        </header>

        <main>
          <p className={styles.prompt}>{'// coming soon'}</p>
          <h1 className={styles.h1}>
            {lines.map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {line.includes('hiring.') ? (
                  <>
                    {line.replace('hiring.', '')}
                    <span className={styles.accent}>hiring.</span>
                  </>
                ) : (
                  line
                )}
              </span>
            ))}
            <span className={`${styles.cursor}${showCursor ? '' : ` ${styles.cursorHidden}`}`} />
          </h1>
          <p className={styles.tagline}>
            Human work on crypto rails.<br />
            <b>USDC payments</b> · <b>Base</b> · <b>x402 protocol</b>
          </p>

          {submitted ? (
            <p className={styles.success}>✓ you&apos;re on the list</p>
          ) : (
            <>
              <div className={styles.form}>
                <input
                  className={styles.input}
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  disabled={loading}
                />
                <button className={styles.btn} onClick={handleSubmit} disabled={loading}>
                  {loading ? '...' : 'GET ACCESS'}
                </button>
              </div>
              {error && <p className={styles.error}>{error}</p>}
            </>
          )}
        </main>

        <div className={styles.meta}>
          <div className={styles.pill}>USDC · BASE</div>
          <div className={styles.pill}>x402 PROTOCOL</div>
          <div className={styles.pill}>COINBASE SMART WALLET</div>
          <div className={styles.pill}>HAAS</div>
        </div>

        <footer className={styles.footer}>
          <div className={styles.baseBadge}>
            <svg className={styles.baseMark} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 111 111" fill="none">
              <path d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 22.1714 0 50.3923H72.8467V59.6416H0C2.35281 87.8625 26.0432 110.034 54.921 110.034Z" fill="white"/>
            </svg>
            <span>BUILT ON BASE</span>
          </div>
          <br />
          CARBON&#8209;CONTRACTORS.COM &nbsp;&middot;&nbsp; EST. 2026
        </footer>
      </div>
    </div>
  )
}
