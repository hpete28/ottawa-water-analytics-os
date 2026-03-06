import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles } from 'lucide-react';

export default function AiInsights({ scrapeStart, scrapeEnd }) {
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);

    const generateInsights = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/insights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startDate: scrapeStart, endDate: scrapeEnd }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Failed to generate insights');
            }

            setReport(data.report);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: report || loading || error ? '1.5rem' : '0' }}>
                <div>
                    <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                        <Sparkles size={18} color="var(--primary)" />
                        AI Insights
                    </h2>
                    <p className="card-subtitle" style={{ margin: 0, marginTop: '0.25rem' }}>
                        Discover correlations between your water usage, humidity, and temperature.
                    </p>
                </div>

                <button
                    className="btn btn-primary"
                    onClick={generateInsights}
                    disabled={loading || !scrapeStart || !scrapeEnd}
                    style={{ background: 'linear-gradient(135deg, var(--primary), #a855f7)' }}
                >
                    {loading ? (
                        <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Analyzing...</>
                    ) : (
                        <><Sparkles size={14} /> Generate Analysis</>
                    )}
                </button>
            </div>

            {/* States */}
            {error && (
                <div className="cookie-warning" style={{ marginTop: '1rem' }}>
                    <span>⚠️</span>
                    <span>{error}</span>
                </div>
            )}

            {loading && (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div className="spinner" style={{ width: 24, height: 24, borderWidth: 3, marginBottom: '1rem' }} />
                    <p>Gemini is crunching the numbers for you...</p>
                </div>
            )}

            {report && !loading && (
                <div className="ai-report" style={{
                    background: 'var(--bg-elevated)',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    fontSize: '0.95rem',
                    lineHeight: '1.6',
                    color: 'var(--text)'
                }}>
                    <ReactMarkdown>{report}</ReactMarkdown>
                </div>
            )}
        </div>
    );
}
