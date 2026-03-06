import React, { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import SummaryCards from './components/SummaryCards'
import CompositeChart from './components/CompositeChart'
import HourlyChart from './components/HourlyChart'
import WeatherPanel from './components/WeatherPanel'
import AiInsights from './components/AiInsights'
import DailyTable from './components/DailyTable'
import BillingPanel from './components/BillingPanel'
import './index.css'

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDateOffset(offset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}

function getCurrentMonth(dateStr) {
  const s = dateStr || new Date().toISOString()
  return s.substring(0, 7)
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  // Scrape range — default: last 7 days → yesterday
  const [scrapeStart, setScrapeStart] = useState(getDateOffset(-7))
  const [scrapeEnd, setScrapeEnd] = useState(getDateOffset(-1))

  // View range — composite chart always uses scrapeStart → scrapeEnd
  // Single-day view for hourly chart
  const [viewDate, setViewDate] = useState(getDateOffset(-1))

  // Derived: month for summary cards = month of scrapeEnd
  const selectedMonth = scrapeEnd ? scrapeEnd.substring(0, 7) : ''

  const [scraping, setScraping] = useState(false)
  const [scrapeStatus, setScrapeStatus] = useState(null)
  const [scrapeDetail, setScrapeDetail] = useState('')

  // Data
  const [summary, setSummary] = useState(null)
  const [hourlyData, setHourlyData] = useState(null)
  const [weatherData, setWeatherData] = useState(null)
  const [dailyData, setDailyData] = useState(null)

  // Loading
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingHourly, setLoadingHourly] = useState(false)
  const [loadingWeather, setLoadingWeather] = useState(false)

  // ── Fetch summary ──────────────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true)
    try {
      const res = await fetch(`/api/summary?start=${scrapeStart}&end=${scrapeEnd}`)
      const data = await res.json()
      setSummary(data)
    } catch (e) { console.error('Summary fetch failed:', e) }
    finally { setLoadingSummary(false) }
  }, [scrapeStart, scrapeEnd])

  // ── Fetch hourly for view date ─────────────────────────────────────────────
  const fetchHourly = useCallback(async () => {
    setLoadingHourly(true)
    try {
      const res = await fetch(`/api/water-usage?date=${viewDate}`)
      const data = await res.json()
      setHourlyData(data)
    } catch (e) { console.error('Hourly fetch failed:', e) }
    finally { setLoadingHourly(false) }
  }, [viewDate])

  // ── Fetch weather + daily totals for composite chart ───────────────────────
  const fetchChartData = useCallback(async () => {
    setLoadingWeather(true)
    try {
      const [wRes, dRes] = await Promise.all([
        fetch(`/api/weather?start=${scrapeStart}&end=${scrapeEnd}`),
        fetch(`/api/daily-usage?start=${scrapeStart}&end=${scrapeEnd}`),
      ])
      const [wData, dData] = await Promise.all([wRes.json(), dRes.json()])
      setWeatherData(wData)
      setDailyData(dData)
    } catch (e) { console.error('Chart data fetch failed:', e) }
    finally { setLoadingWeather(false) }
  }, [scrapeStart, scrapeEnd])

  // ── Scrape range ───────────────────────────────────────────────────────────
  const triggerScrape = async () => {
    if (!scrapeStart || !scrapeEnd || scrapeStart > scrapeEnd) return
    setScraping(true)
    setScrapeStatus(null)
    setScrapeDetail('')

    const days = Math.round((new Date(scrapeEnd) - new Date(scrapeStart)) / 86400000) + 1

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: scrapeStart, endDate: scrapeEnd }),
      })
      const data = await res.json()

      const cookieErr = data.errors?.some(e =>
        /cookie|auth|401|403/i.test(e.message || '')
      )

      if (cookieErr) {
        setScrapeStatus('cookie_error')
      } else if (data.errors?.length) {
        setScrapeStatus('error')
        setScrapeDetail(data.errors.map(e => e.message).join(' · '))
      } else {
        const inserted = data.results?.reduce((s, r) => s + (r.rowsInserted ?? 0), 0) ?? 0
        setScrapeStatus('ok')
        setScrapeDetail(`${days} day${days > 1 ? 's' : ''} scraped · ${inserted} water rows ingested`)
        fetchSummary()
        fetchHourly()
        fetchChartData()
      }
    } catch (e) {
      setScrapeStatus('error')
      setScrapeDetail(e.message)
    } finally {
      setScraping(false)
    }
  }

  // ── Effects — refetch when date ranges change ──────────────────────────────
  useEffect(() => { fetchSummary() }, [fetchSummary])
  useEffect(() => { fetchHourly() }, [fetchHourly])
  useEffect(() => { fetchChartData() }, [fetchChartData])

  // When scrape range changes, also derive a sensible view date (end of range)
  useEffect(() => {
    if (scrapeEnd && scrapeEnd !== viewDate) setViewDate(scrapeEnd)
  }, [scrapeEnd]) // eslint-disable-line

  // Smart default: If the current viewDate has NO water data, but there are earlier days with data, snap to the latest valid day.
  // This prevents the Hourly chart from defaulting to a blank "today" when the water utility is a day or two behind.
  useEffect(() => {
    if (summary?.data?.length > 0) {
      const currentDayData = summary.data.find(d => d.date === viewDate)
      if (!currentDayData || currentDayData.totalConsumption === 0) {
        const validDays = summary.data.filter(d => d.totalConsumption > 0)
        if (validDays.length > 0) {
          setViewDate(validDays[validDays.length - 1].date)
        }
      }
    }
  }, [summary]) // eslint-disable-line

  // ── Scrape range ───────────────────────────────────────────────────────────

  const exportToCsv = () => {
    if (!dailyData?.data && !weatherData?.data) return

    const byDate = {}
    const wRows = weatherData?.data || []
    for (const w of wRows) {
      byDate[w.date] = { date: w.date, maxTemp: w.max_temp, meanTemp: w.mean_temp, humidity: w.avg_humidity }
    }
    const dRows = dailyData?.data || []
    for (const d of dRows) {
      if (!byDate[d.date]) byDate[d.date] = { date: d.date }
      byDate[d.date].consumption = d.totalConsumption
    }

    const rows = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))

    const csvContent = [
      ['Date', 'Consumption (m3)', 'Max Temp (C)', 'Mean Temp (C)', 'Avg Humidity (%)'].join(','),
      ...rows.map(r => [
        r.date,
        r.consumption ?? '',
        r.maxTemp ?? '',
        r.meanTemp ?? '',
        r.humidity ?? ''
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `water_analytics_${scrapeStart}_to_${scrapeEnd}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="app-layout">
      <Header
        scrapeStart={scrapeStart}
        scrapeEnd={scrapeEnd}
        onScrapeStartChange={setScrapeStart}
        onScrapeEndChange={setScrapeEnd}
        viewDate={viewDate}
        onViewDateChange={setViewDate}
        onScrape={triggerScrape}
        scraping={scraping}
        onExportCsv={exportToCsv}
      />

      <main className="main-content">

        {/* Status banners */}
        {scrapeStatus === 'cookie_error' && (
          <div className="cookie-warning">
            <span>⚠️</span>
            <span>
              <strong>Session cookie expired.</strong> Log into{' '}
              <a href="https://water-billing.ottawa.ca" target="_blank" rel="noreferrer"
                style={{ color: '#f87171', textDecoration: 'underline' }}>
                water-billing.ottawa.ca
              </a>
              , copy a fresh cookie from DevTools → Network → Cookie header, and update <code>.env</code>.
            </span>
          </div>
        )}
        {scrapeStatus === 'error' && (
          <div className="cookie-warning">
            <span>⚠️</span>
            <span>Scrape failed{scrapeDetail ? `: ${scrapeDetail}` : ''}. Check the backend console.</span>
          </div>
        )}
        {scrapeStatus === 'ok' && (
          <div className="cookie-warning"
            style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)', color: '#6ee7b7' }}>
            <span>✅</span>
            <span>Scraped successfully! {scrapeDetail}</span>
          </div>
        )}

        {/* KPI Cards — driven by month of scrapeEnd */}
        <SummaryCards summary={summary} loading={loadingSummary} month={selectedMonth} />

        {/* Composite chart + weather */}
        <div className="section-grid" style={{ marginBottom: '1.25rem' }}>
          <CompositeChart
            weatherData={weatherData}
            dailyData={dailyData}
            loading={loadingWeather}
            dateRange={{ start: scrapeStart, end: scrapeEnd }}
            onDayClick={(dateStr) => setViewDate(dateStr)}
          />
          <WeatherPanel weatherData={weatherData} loading={loadingWeather} />
        </div>

        {/* Hourly breakdown for viewDate */}
        <HourlyChart
          hourlyData={hourlyData}
          loading={loadingHourly}
          date={viewDate}
        />

        {/* Daily Meter Readings Table */}
        <DailyTable dailyData={dailyData} loading={loadingWeather} />

        {/* Billing Summary */}
        <BillingPanel scrapeStart={scrapeStart} scrapeEnd={scrapeEnd} />

        {/* AI Insights Panel */}
        <AiInsights scrapeStart={scrapeStart} scrapeEnd={scrapeEnd} />

      </main>
    </div>
  )
}
