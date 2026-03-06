import React, { useMemo, useState } from 'react'
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CompositeTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
        <div className="custom-tooltip">
            <div className="tooltip-label">{label}</div>
            {payload.map((p, i) => (
                <div className="tooltip-row" key={i}>
                    <span className="tooltip-dot" style={{ background: p.color }} />
                    <span style={{ color: 'var(--text-muted)', minWidth: 70 }}>{p.name}</span>
                    <strong>{p.value != null ? Number(p.value).toFixed(3) : 'N/A'}</strong>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{p.unit}</span>
                </div>
            ))}
        </div>
    )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CompositeChart({ weatherData, dailyData, loading, onDayClick }) {
    const [secondaryMetric, setSecondaryMetric] = useState('temp') // 'temp' or 'humidity'

    const chartData = useMemo(() => {
        const wRows = weatherData?.data || []
        const dRows = dailyData?.data || []

        if (!wRows.length && !dRows.length) return []

        const byDate = {}

        // Add weather rows
        for (const w of wRows) {
            byDate[w.date] = {
                date: w.date.substring(5), // MM-DD for x-axis
                fullDate: w.date,
                maxTemp: w.max_temp,
                meanTemp: w.mean_temp,
                humidity: w.avg_humidity,
            }
        }

        // Add/update water rows
        for (const d of dRows) {
            if (!byDate[d.date]) {
                byDate[d.date] = {
                    date: d.date.substring(5),
                    fullDate: d.date,
                }
            }
            byDate[d.date].consumption = d.totalConsumption
        }

        return Object.values(byDate).sort((a, b) => a.fullDate.localeCompare(b.fullDate))
    }, [weatherData, dailyData])

    const isTemp = secondaryMetric === 'temp'
    const secondaryColor = isTemp ? 'var(--chart-temp)' : 'var(--chart-humid)'
    const secondaryName = isTemp ? 'Max Temp' : 'Avg Humidity'
    const secondaryUnit = isTemp ? '°C' : '%'
    const secondaryKey = isTemp ? 'maxTemp' : 'humidity'
    const secondaryFormatter = isTemp ? v => `${v}°` : v => `${v}%`

    return (
        <div className="card">
            <div className="section-header">
                <div>
                    <div className="section-title">Water vs Weather</div>
                    <div className="section-sub">Water consumption (bars) overlaid with {secondaryName.toLowerCase()} (line)</div>
                </div>
                {chartData.length > 0 && (
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="badge badge-blue">💧 Usage m³</span>
                        <div className="toggle-group">
                            <button
                                className={`toggle-btn ${isTemp ? 'active' : ''}`}
                                onClick={() => setSecondaryMetric('temp')}
                            >
                                🌡 Temp
                            </button>
                            <button
                                className={`toggle-btn ${!isTemp ? 'active' : ''}`}
                                onClick={() => setSecondaryMetric('humidity')}
                            >
                                💧 Humidity
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="loading-overlay">
                    <div className="spinner" />
                    Fetching weather data…
                </div>
            ) : chartData.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📊</div>
                    <div className="empty-state-title">No data to display</div>
                    <div className="empty-state-sub">Hit Scrape to populate weather + usage data</div>
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart
                        data={chartData}
                        margin={{ top: 8, right: 16, left: -10, bottom: 0 }}
                        onClick={(state) => {
                            if (state?.activePayload?.length && onDayClick) {
                                onDayClick(state.activePayload[0].payload.fullDate)
                            }
                        }}
                        style={{ cursor: 'pointer' }}
                        title="Click a day to view its hourly breakdown"
                    >
                        <CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                        />
                        {/* Left axis — water consumption */}
                        <YAxis
                            yAxisId="usage"
                            orientation="left"
                            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={v => v.toFixed(2)}
                            label={{ value: 'm³', angle: -90, position: 'insideLeft', offset: 14, style: { fontSize: 10, fill: 'var(--text-muted)' } }}
                        />
                        {/* Right axis — temperature */}
                        <YAxis
                            yAxisId="secondary"
                            orientation="right"
                            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={secondaryFormatter}
                        />
                        <Tooltip content={<CompositeTooltip />} />
                        <Legend
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: 12 }}
                        />
                        <Bar
                            yAxisId="usage"
                            dataKey="consumption"
                            name="Usage"
                            unit="m³"
                            fill="var(--chart-bar)"
                            fillOpacity={0.85}
                            radius={[4, 4, 0, 0]}
                            maxBarSize={28}
                        />
                        <Line
                            yAxisId="secondary"
                            type="monotone"
                            dataKey={secondaryKey}
                            name={secondaryName}
                            unit={secondaryUnit}
                            stroke={secondaryColor}
                            strokeWidth={2}
                            dot={{ r: 3, fill: secondaryColor, strokeWidth: 0 }}
                            activeDot={{ r: 5 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            )}
        </div>
    )
}
