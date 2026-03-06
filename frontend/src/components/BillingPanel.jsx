import React, { useState, useEffect } from 'react'

/**
 * BillingPanel
 * Shows monthly billing stats and the latest invoice details.
 * Props:
 *   scrapeStart — YYYY-MM-DD
 *   scrapeEnd   — YYYY-MM-DD
 */
export default function BillingPanel({ scrapeStart, scrapeEnd }) {
    const [billingData, setBillingData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [scraping, setScraping] = useState(false)
    const [message, setMessage] = useState('')

    useEffect(() => {
        fetchBilling()
    }, [])

    async function fetchBilling() {
        setLoading(true)
        try {
            const res = await fetch('/api/billing')
            const data = await res.json()
            setBillingData(data.data ?? [])
        } catch (e) { console.error('Billing fetch failed:', e) }
        finally { setLoading(false) }
    }

    async function triggerBillingScrape() {
        setScraping(true)
        setMessage('')
        try {
            const res = await fetch('/api/scrape/billing')
            const data = await res.json()
            if (data.success) {
                setMessage('✅ Billing data refreshed successfully!')
                fetchBilling()
            } else {
                setMessage('⚠️ Could not refresh billing data.')
            }
        } catch (e) {
            setMessage(`⚠️ Error: ${e.message}`)
        } finally {
            setScraping(false)
        }
    }

    const invoices = billingData ?? []
    const latest = invoices[0]

    // Monthly usage data rolled up from summary API
    return (
        <div className="panel" style={{ marginBottom: '1.25rem' }}>
            <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="panel-title">💳 Billing Summary</h2>
                <button
                    onClick={triggerBillingScrape}
                    disabled={scraping}
                    style={{
                        background: 'rgba(99,102,241,0.15)',
                        border: '1px solid rgba(99,102,241,0.4)',
                        borderRadius: '0.5rem',
                        color: '#a5b4fc',
                        padding: '0.35rem 0.85rem',
                        fontSize: '0.8rem',
                        cursor: scraping ? 'not-allowed' : 'pointer',
                    }}
                >
                    {scraping ? '⏳ Refreshing…' : '🔄 Refresh'}
                </button>
            </div>

            {message && (
                <div style={{
                    background: 'rgba(16,185,129,0.08)',
                    border: '1px solid rgba(16,185,129,0.25)',
                    borderRadius: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    marginBottom: '0.75rem',
                    color: '#6ee7b7',
                    fontSize: '0.85rem',
                }}>
                    {message}
                </div>
            )}

            {loading ? (
                <div className="loading-state">Loading billing data…</div>
            ) : !latest ? (
                <div className="empty-state">
                    No billing records found. Click <strong>Refresh</strong> to fetch from Ottawa Water Portal.
                </div>
            ) : (
                <>
                    {/* Current Invoice Card */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: '0.75rem',
                        marginBottom: '1rem',
                    }}>
                        <StatCard label="Last Bill Amount" value={`$${latest.current_balance?.toFixed(2) ?? '—'}`} sub={latest.bill_date} color="#60a5fa" />
                        <StatCard label="Due Date" value={latest.due_date ?? '—'} color="#fb923c" />
                        <StatCard label="Past Due Balance" value={`$${latest.past_balance?.toFixed(2) ?? '—'}`} color={latest.past_balance > 0 ? '#f87171' : '#6ee7b7'} />
                        <StatCard label="Total Balance" value={`$${latest.total_balance?.toFixed(2) ?? '—'}`} color={latest.total_balance > 0 ? '#fbbf24' : '#6ee7b7'} />
                    </div>

                    {/* Invoice History Table */}
                    {invoices.length > 1 && (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        <th style={thStyle}>Bill #</th>
                                        <th style={thStyle}>Bill Date</th>
                                        <th style={thStyle}>Due Date</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>Total Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map((inv) => (
                                        <tr key={inv.bill_number} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={tdStyle}>{inv.bill_number}</td>
                                            <td style={tdStyle}>{inv.bill_date}</td>
                                            <td style={tdStyle}>{inv.due_date}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: '#60a5fa' }}>
                                                ${inv.current_balance?.toFixed(2) ?? '—'}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', color: inv.total_balance > 0 ? '#fbbf24' : '#6ee7b7' }}>
                                                ${inv.total_balance?.toFixed(2) ?? '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

function StatCard({ label, value, sub, color }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '0.75rem',
            padding: '0.85rem 1rem',
        }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
                {label}
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: color ?? '#f1f5f9' }}>
                {value}
            </div>
            {sub && <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{sub}</div>}
        </div>
    )
}

const thStyle = {
    padding: '0.5rem 0.75rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    textAlign: 'left',
}

const tdStyle = {
    padding: '0.5rem 0.75rem',
    verticalAlign: 'middle',
}
