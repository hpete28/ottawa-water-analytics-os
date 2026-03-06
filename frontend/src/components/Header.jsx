import React from 'react'
import { RefreshCw, CalendarRange, Eye } from 'lucide-react'

export default function Header({
    // Scrape range
    scrapeStart, scrapeEnd, onScrapeStartChange, onScrapeEndChange,
    // View date (hourly chart)
    viewDate, onViewDateChange,
    // Actions
    onScrape, scraping, onExportCsv,
}) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    // Count days in selected scrape range
    const rangeDays = scrapeStart && scrapeEnd
        ? Math.max(0, Math.round((new Date(scrapeEnd) - new Date(scrapeStart)) / 86400000) + 1)
        : 0

    return (
        <header className="app-header" style={{ height: 'auto', padding: '0.75rem 2rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            {/* Brand */}
            <div className="header-brand">
                <div className="header-brand-icon">💧</div>
                <div>
                    <div className="header-brand-name">Ottawa Water Analytics</div>
                    <div className="header-brand-sub">Local · Self-hosted · Real-time</div>
                </div>
            </div>

            {/* Controls */}
            <div className="header-actions" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>

                {/* API status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span className="status-dot online" title="Backend connected" />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>API</span>
                </div>

                {/* ── Scrape range group ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: '10px', padding: '0.35rem 0.75rem',
                }}>
                    <CalendarRange size={13} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: 2 }}>Scrape</span>
                    <input
                        type="date"
                        className="date-input"
                        value={scrapeStart}
                        onChange={e => onScrapeStartChange(e.target.value)}
                        max={yesterday}
                        style={{ border: 'none', background: 'transparent', padding: '0 0.25rem', width: 130 }}
                        title="Scrape range start"
                    />
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>→</span>
                    <input
                        type="date"
                        className="date-input"
                        value={scrapeEnd}
                        onChange={e => onScrapeEndChange(e.target.value)}
                        min={scrapeStart}
                        max={yesterday}
                        style={{ border: 'none', background: 'transparent', padding: '0 0.25rem', width: 130 }}
                        title="Scrape range end"
                    />
                    {rangeDays > 0 && (
                        <span className="badge badge-blue" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                            {rangeDays}d
                        </span>
                    )}
                </div>

                {/* Scrape button */}
                <button
                    className="btn btn-primary"
                    onClick={onScrape}
                    disabled={scraping || !scrapeStart || !scrapeEnd || scrapeStart > scrapeEnd}
                    title={`Scrape water + weather for ${rangeDays} day${rangeDays !== 1 ? 's' : ''}`}
                >
                    {scraping
                        ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Scraping…</>
                        : <><RefreshCw size={14} /> Scrape {rangeDays > 1 ? `${rangeDays} Days` : 'Day'}</>
                    }
                </button>

                {/* Export CSV button */}
                {onExportCsv && (
                    <button
                        className="btn"
                        onClick={onExportCsv}
                        title="Download displayed data as CSV"
                        style={{ padding: '0.45rem 0.6rem' }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </button>
                )}

                {/* ── View date (for hourly chart) ── */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: '10px', padding: '0.35rem 0.75rem',
                }}>
                    <Eye size={13} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: 2 }}>View day</span>
                    <input
                        type="date"
                        className="date-input"
                        value={viewDate}
                        onChange={e => onViewDateChange(e.target.value)}
                        max={yesterday}
                        style={{ border: 'none', background: 'transparent', padding: '0 0.25rem', width: 130 }}
                        title="Select a specific day to view hourly breakdown"
                    />
                </div>
            </div>
        </header>
    )
}
