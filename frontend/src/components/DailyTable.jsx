import React from 'react'

// Format a YYYY-MM-DD string to human-friendly display
function fmtDate(dateStr) {
    if (!dateStr) return '—'
    const [y, m, d] = dateStr.split('-')
    return new Date(Date.UTC(+y, +m - 1, +d)).toLocaleDateString('en-CA', {
        year: 'numeric', month: 'short', day: 'numeric',
    })
}

/**
 * DailyTable
 * Shows a daily meter read table: Date | Days Since Last | Usage (m³) | Running Total
 * Props:
 *   dailyData  — { data: [{ date, totalConsumption }] }
 *   loading    — bool
 */
export default function DailyTable({ dailyData, loading }) {
    const rows = dailyData?.data ?? []

    // Build running cumulative total and days-gap
    let cumulative = 0
    const tableRows = rows.map((row, idx) => {
        cumulative += row.totalConsumption ?? 0
        const prevDate = idx > 0 ? rows[idx - 1].date : null
        let dayGap = '—'
        if (prevDate) {
            const [y1, m1, d1] = row.date.split('-').map(Number)
            const [y0, m0, d0] = prevDate.split('-').map(Number)
            const diff = (Date.UTC(y1, m1 - 1, d1) - Date.UTC(y0, m0 - 1, d0)) / 86400000
            dayGap = diff
        }
        return { ...row, dayGap, cumulative: +cumulative.toFixed(3) }
    })

    return (
        <div className="panel" style={{ marginBottom: '1.25rem' }}>
            <div className="panel-header">
                <h2 className="panel-title">📋 Daily Meter Readings</h2>
                <span className="panel-meta">{rows.length} days</span>
            </div>

            {loading ? (
                <div className="loading-state">Loading readings…</div>
            ) : rows.length === 0 ? (
                <div className="empty-state">No data for this range. Run the scraper first.</div>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left' }}>
                                <th style={thStyle}>Meter Read Date</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Days</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Usage (m³)</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Current Read (m³)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...tableRows].reverse().map((row) => (
                                <tr key={row.date} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={tdStyle}>{fmtDate(row.date)}</td>
                                    <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>
                                        {row.dayGap}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                                        <span style={{ color: usageColor(row.totalConsumption) }}>
                                            {row.totalConsumption?.toFixed(3) ?? '—'}
                                        </span>
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-muted)' }}>
                                        {row.cumulative.toFixed(3)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                                <td style={{ ...tdStyle, fontWeight: 700 }} colSpan={2}>Total</td>
                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: 'var(--accent-blue)' }}>
                                    {tableRows.reduce((s, r) => s + (r.totalConsumption ?? 0), 0).toFixed(3)} m³
                                </td>
                                <td style={tdStyle} />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    )
}

const thStyle = {
    padding: '0.5rem 0.75rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
    fontSize: '0.78rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
}

const tdStyle = {
    padding: '0.5rem 0.75rem',
    verticalAlign: 'middle',
}

function usageColor(val) {
    if (!val || val === 0) return 'var(--text-muted)'
    if (val > 1.0) return '#f87171'
    if (val > 0.5) return '#fb923c'
    return '#6ee7b7'
}
