import React from 'react'
import { Thermometer, Droplets, Wind } from 'lucide-react'

function WeatherRow({ icon, color, label, value, unit }) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.6rem 0',
            borderBottom: '1px solid var(--border-subtle)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {React.cloneElement(icon, { size: 14, color })}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{label}</span>
            </div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {value != null ? `${value}${unit}` : '—'}
            </span>
        </div>
    )
}

export default function WeatherPanel({ weatherData, loading }) {
    // Use the most recent weather row
    const latest = weatherData?.data?.[weatherData.data.length - 1]

    return (
        <div className="card">
            <div className="section-header" style={{ marginBottom: '0.5rem' }}>
                <div>
                    <div className="section-title">Latest Weather</div>
                    <div className="section-sub">
                        {latest ? `Ottawa · ${latest.date}` : 'Ottawa, ON'}
                    </div>
                </div>
                <span style={{ fontSize: '1.8rem' }}>
                    {loading ? '…' : latest?.max_temp > 15 ? '☀️' : latest?.max_temp > 0 ? '🌤️' : '❄️'}
                </span>
            </div>

            {loading ? (
                <div className="loading-overlay" style={{ padding: '2rem' }}>
                    <div className="spinner" />
                </div>
            ) : !latest ? (
                <div className="empty-state" style={{ padding: '1.5rem' }}>
                    <div className="empty-state-title">No weather data</div>
                    <div className="empty-state-sub">Hit Scrape to fetch Open-Meteo data</div>
                </div>
            ) : (
                <>
                    <WeatherRow icon={<Thermometer />} color="var(--accent-temp)"
                        label="Max Temp" value={latest.max_temp?.toFixed(1)} unit="°C" />
                    <WeatherRow icon={<Thermometer />} color="var(--accent-blue)"
                        label="Mean Temp" value={latest.mean_temp?.toFixed(1)} unit="°C" />
                    <WeatherRow icon={<Droplets />} color="var(--accent-humid)"
                        label="Humidity" value={latest.avg_humidity?.toFixed(0)} unit="%" />

                    {/* Mini 7-day temp trend */}
                    {weatherData.data.length > 1 && (
                        <div style={{ marginTop: '1rem' }}>
                            <div className="card-title" style={{ marginBottom: '0.5rem' }}>7-Day Trend</div>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '48px' }}>
                                {weatherData.data.slice(-7).map((w, i) => {
                                    const temp = w.max_temp ?? 0
                                    const maxT = Math.max(...weatherData.data.slice(-7).map(d => d.max_temp ?? 0))
                                    const minT = Math.min(...weatherData.data.slice(-7).map(d => d.max_temp ?? 0))
                                    const range = maxT - minT || 1
                                    const height = Math.max(6, ((temp - minT) / range) * 40)
                                    const isLast = i === weatherData.data.slice(-7).length - 1
                                    return (
                                        <div key={w.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                            <div style={{
                                                width: '100%',
                                                height: `${height}px`,
                                                background: isLast ? 'var(--accent-temp)' : 'var(--border)',
                                                borderRadius: '3px 3px 0 0',
                                                transition: 'height 0.3s ease',
                                            }} />
                                            <span style={{ fontSize: '0.6rem', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>
                                                {w.date.substring(8)}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
