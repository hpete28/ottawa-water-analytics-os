import React from 'react'
import { Droplets, BarChart2, Flame, Calendar } from 'lucide-react'

function StatCard({ icon, iconBg, iconColor, title, value, unit, sub, loading }) {
    return (
        <div className="card">
            <div className="card-icon" style={{ background: iconBg }}>
                {React.cloneElement(icon, { size: 18, color: iconColor })}
            </div>
            <div className="card-title">{title}</div>
            {loading
                ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                    <div className="spinner" />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading…</span>
                </div>
                : <>
                    <div className="card-value">
                        {value ?? '—'}
                        {unit && <span className="card-unit">{unit}</span>}
                    </div>
                    {sub && <div className="card-sub">{sub}</div>}
                </>
            }
        </div>
    )
}

export default function SummaryCards({ summary, loading, month }) {
    const total = summary?.totalMonthConsumption
    const avg = summary?.avgDailyUsage
    const peak = summary?.highestUsageDay
    const days = summary?.daysWithData

    return (
        <div className="summary-grid">
            <StatCard
                icon={<Droplets />}
                iconBg="rgba(14,165,233,0.15)"
                iconColor="var(--accent-water)"
                title="Month Total"
                value={total != null ? total.toFixed(3) : null}
                unit="m³"
                sub={month ? `${month} · ${days ?? 0} days scraped` : ''}
                loading={loading}
            />
            <StatCard
                icon={<BarChart2 />}
                iconBg="rgba(59,130,246,0.15)"
                iconColor="var(--accent-blue)"
                title="Avg Daily Usage"
                value={avg != null ? avg.toFixed(3) : null}
                unit="m³/day"
                sub="Mean of all scraped days"
                loading={loading}
            />
            <StatCard
                icon={<Flame />}
                iconBg="rgba(249,115,22,0.15)"
                iconColor="var(--accent-temp)"
                title="Highest Usage Day"
                value={peak ? peak.totalConsumption.toFixed(3) : null}
                unit="m³"
                sub={peak ? peak.date : 'No data yet'}
                loading={loading}
            />
            <StatCard
                icon={<Calendar />}
                iconBg="rgba(167,139,250,0.15)"
                iconColor="var(--accent-humid)"
                title="Days Recorded"
                value={days ?? null}
                unit="days"
                sub={`of data in ${month}`}
                loading={loading}
            />
        </div>
    )
}
