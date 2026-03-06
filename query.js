const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./water_analytics.db');

db.all(`SELECT date, SUM(consumption_amount) as total FROM water_usage WHERE date LIKE '2025-12%' OR date LIKE '2026-01%' GROUP BY date ORDER BY date ASC`, (err, rows) => {
    if (err) console.error(err);
    else console.table(rows);
});
