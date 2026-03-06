# Project Constitution: Ottawa Water Analytics Dashboard

## 1. Project Vision
Build a local, self-hosted web application that scrapes Ottawa water usage, fetches historical weather data, and displays beautiful analytical trends correlating water usage with temperature and humidity. 

**Tech Stack:**
- **Frontend:** React (built with Vite), Tailwind CSS for styling, Recharts for robust visualizations.
- **Backend:** Node.js with Express.
- **Database:** SQLite (local, self-contained data store).
- **Integrations:** 
  - Node.js scraper for extracting data from the Ottawa Water Portal (auth via Puppeteer headless browser cookie extraction).
  - Open-Meteo Historical Weather API for querying weather parameters.
  - Google Gemini API (`@google/generative-ai`) for automated data correlation insights.

## 2. Source of Truth
The singular source of truth for the application's state is the local SQLite database.

## 3. Data-First Schema

### Table: `water_usage`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INTEGER | Primary Key, Auto-increment |
| `date` | TEXT | Format: `YYYY-MM-DD` |
| `hour` | INTEGER | `0-23` indicating the hour |
| `consumption_amount`| REAL | Parsed from `axisY` in Ottawa API JSON |

### Table: `weather_log`
| Column | Type | Description |
| :--- | :--- | :--- |
| `date` | TEXT | Primary Key. Format: `YYYY-MM-DD` |
| `max_temp` | REAL | Maximum temperature of the day |
| `mean_temp` | REAL | Mean temperature of the day |
| `avg_humidity` | REAL | Average humidity of the day |

## 4. High-Risk Areas
- **Authentication Volatility:** Scrape authentication relies on a session cookie that expires rapidly.
  - *Mitigation:* We use Puppeteer to headlessly automate the login flow (Azure AD / Shibboleth SAML) and overwrite `.env` with fresh cookies on demand.
- **API Schema Alterations:** The Ottawa Water portal may change its JSON response format (`axisX` to time, `axisY` to consumption), which could break ingestion logic.
- **Date Matching Constraints:** Ensuring time-zone alignment between the scraped Ottawa water data and the Open-Meteo API payload to prevent skewed day correlations. 
