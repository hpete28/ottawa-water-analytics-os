import React, { useMemo } from 'react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function HourlyTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    const val = payload[0]?.value ?? 0
    return (
        <div className="custom-tooltip">
            <div className="tooltip-label">{label}</div>
            <div className="tooltip-row">
                <span className="tooltip-dot" style={{ background: 'var(--chart-bar)' }} />
                <span style={{ color: 'var(--text-muted)' }}>Usage</span>
                <strong>{val.toFixed(3)} m³</strong>
            </div>
        </div>
    )
}

// Hour label map (0-23 → display string)
const HOUR_LABELS = [
    '12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM', '6 AM', '7 AM',
    '8 AM', '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM',
    '4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM', '10 PM', '11 PM',
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function HourlyChart({ hourlyData, loading, date }) {
    const chartData = useMemo(() => {
        if (!hourlyData?.data) return []
        return hourlyData.data.map(row => ({
            hour: HOUR_LABELS[row.hour] ?? `H${row.hour}`,
            hourNum: row.hour,
            usage: row.consumption_amount ?? 0,
        }))
    }, [hourlyData])

    const peak = useMemo(() => {
        if (!chartData.length) return null
        return chartData.reduce((max, r) => (r.usage > max.usage ? r : max), chartData[0])
    }, [chartData])

    const totalDay = useMemo(
        () => chartData.reduce((s, r) => s + r.usage, 0),
        [chartData]
    )

    // Color bars: peak is accent-temp, rest are accent-water
    const getPeakHour = (hourNum) => peak?.hourNum === hourNum

    return (
        <div className="card">
            <div className="section-header">
                <div>
                    <div className="section-title">Hourly Breakdown — {date}</div>
                    <div className="section-sub">
                        {chartData.length > 0
                            ? `Total: ${totalDay.toFixed(3)} m³ · Peak: ${peak.hour} (${peak.usage.toFixed(3)} m³)`
                            : 'No data for this date'}
                    </div>
                </div>
                {chartData.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <span className="badge badge-blue">💧 m³ / hour</span>
                        <span className="badge badge-orange">🔥 Peak hour</span>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="loading-overlay">
                    <div className="spinner" />
                    Loading hourly data…
                </div>
            ) : chartData.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🕐</div>
                    <div className="empty-state-title">No hourly data for {date}</div>
                    <div className="empty-state-sub">Hit Scrape to fetch this day's usage from the Ottawa Water Portal</div>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                        <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="hour"
                            tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}
                            axisLine={false}
                            tickLine={false}
                            interval={1}
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={v => v.toFixed(3)}
                        />
                        <Tooltip content={<HourlyTooltip />} cursor={{ fill: 'rgba(59,130,246,0.08)' }} />
                        <Bar dataKey="usage" name="Usage" radius={[4, 4, 0, 0]} maxBarSize={32}>
                            {chartData.map((entry) => (
                                <Cell
                                    key={entry.hourNum}
                                    fill={getPeakHour(entry.hourNum) ? 'var(--accent-temp)' : 'var(--chart-bar)'}
                                    fillOpacity={getPeakHour(entry.hourNum) ? 1 : 0.8}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            )}
        </div>
    )
}
