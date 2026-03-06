# Task Plan

## Phase 1: B - Blueprint (Vision & Logic)
- [x] Create project constitution (`Agents.md`).
- [x] Define Data Schema for SQLite (`Agents.md`).
- [x] Create project memory initialization files (`settings.json`, `findings.md`, `progress.md`).

## Phase 2: L - Link (Connectivity)
- [x] Initialize basic Node.js project (`npm init -y`).
- [x] Install backend dependencies (`express`, `sqlite3`, `sqlite`, `dotenv`, `cors`, `axios`).
- [x] Set up `.env` with a placeholder for the Ottawa Water Portal `USER_COOKIE`.
- [x] Write a minimal scraper test script to verify connection to the Ottawa Water portal API.
- [x] Write a minimal test script for fetching Open-Meteo Historical Weather API data.

## Phase 3: A - Architect (Backend & Database Build)
- [x] Run SQLite initialization script to create `water_usage` and `weather_log` tables.
- [x] Build `WaterService.js` to fetch and parse the Ottawa Water Portal JSON (`Data.hourlyUsages[{axisX, axisY}]`) and insert into `water_usage`.
- [x] Build `WeatherService.js` to fetch `max_temp`, `mean_temp`, and `avg_humidity` and insert into `weather_log`.
- [x] Implement Express REST API logic:
  - `GET /api/water-usage`
  - `GET /api/weather`
  - `GET /api/summary` (calculate total month consumption, average daily usage, highest usage day).
  - `POST /api/scrape` (trigger both scrapers on demand).

## Phase 4: S - Stylize (Frontend Build)
- [x] Initialize React frontend using Vite (`npm create vite@latest frontend -- --template react-swc`).
- [x] Install Tailwind CSS, Recharts, and lucide-react.
- [x] Build layout and routing wrappers.
- [x] Create the **Summary Cards Component** to display totals and averages.
- [x] Create the **Composite Chart Component** using Recharts (Daily consumption bar chart + max temp line chart).
- [x] Wire frontend components to fetch data from the Express backend APIs.

## Phase 5: T - Trigger (Testing & Polish)
- [x] Conduct E2E testing: verify a scraper run populates SQLite and the UI reflects correct parameters.
- [x] Handle error states gracefully (e.g., UI indication if the Cookie has expired).

## Phase 6: Humidity Analytics
- [x] Integrate Open-Meteo Humidity data into the `weather_log` schema.
- [x] Add toggle buttons to `CompositeChart.jsx` to switch secondary metric between Max Temp and Avg Humidity.

## Phase 7: Interactive Chart & Range Fix
- [x] Add `GET /api/daily-usage` endpoint to `server.js` for precise date ranges.
- [x] Wire `ComposedChart` `onClick` to update the hourly breakdown view on the fly.

## Phase 8: Data Fixes & CSV Export 
- [x] Fix the Summary KPIs to accurately reflect the selected scraper date range.
- [x] Add a direct CSV download function to the Header.

## Phase 9: AI Insights Integration
- [x] Install `@google/generative-ai` SDK.
- [x] Build `services/AIService.js` and `POST /api/insights` to feed water and weather data into Gemini 2.5 Flash.
- [x] Create the `AiInsights.jsx` React component to render the markdown analysis on the dashboard.

## Phase 10: Automated Authentication (Headless Browser)
- [x] Install `puppeteer`.
- [x] Build `services/AuthScraper.js` to visibly/headlessly navigate the Ottawa Water Portal login flow.
- [x] Extract the fresh session cookie and automatically write it back to the local `.env` file.
- [x] Update `server.js` to trigger the Auth script silently if the API returns a 401 Unauthorized error.
- [x] Finalize `README.md` startup and run commands for the repository.

## Phase 11: Date Range Stability & Year-End Fixes
- [x] Identify and fix timezone bug (UTC vs EST) skipping Dec 31st data.
- [x] Implement robust date iteration in `WaterService.js` using `Date.UTC`.
- [x] Add dynamic range selector hooks in `App.jsx` to fetch precise history across year boundaries.

## Phase 12: Billing History & Analytics
- [x] Create `billing_history` table in SQLite for invoice tracking.
- [x] Build `services/BillingService.js` to parse invoice numbers, total due, and bill dates.
- [x] Create `BillingPanel.jsx` and `DailyTable.jsx` React components.
- [x] Integrate billing KPIs (Invoice #, Total Due, Due Date) into the main dashboard.
- [x] Patch `AuthScraper.js` to handle **Account Switching** (targeting active account #10041554).
- [ ] Discover and update correct `METER_NUMBER` for Brookwood Cir (Active Account).
- [ ] Connect the "Daily Table" frontend to live daily consumption totals.
