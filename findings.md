# Project Findings & Research

*Use this file to store API observations, specific URL quirks, rate limits, and database constraints.*

---

## 🌊 Ottawa Water Portal API — Confirmed (2026-03-05)

### Hourly Usage Endpoint
```
GET https://water-billing.ottawa.ca/en-ca/API/AdvancedUtility/UsageHistory/summary/GetHourlyUsage
```

**Query Parameters:**
| Param             | Value / Notes                              |
|-------------------|--------------------------------------------|
| `date`            | `YYYY-MM-DD` — the day to fetch            |
| `serviceCode`     | `30` (Water service)                       |
| `showGraphicChart`| `true`                                     |
| `serviceDesc`     | `Water`                                    |
| `serviceUnit`     | `` (empty string)                          |
| `meterNumber`     | `21385413` ← user-specific, stored in .env |

**Required Request Headers:**
| Header                      | Value                                                      |
|-----------------------------|------------------------------------------------------------|
| `Cookie`                    | Full session cookie string (`USER_COOKIE` from .env)       |
| `X-Requested-With`          | `XMLHttpRequest`                                           |
| `RequestVerificationToken`  | Value of `__RequestVerificationToken` extracted from Cookie|
| `moduleid`                  | `480` (DNN portal module ID, from `MODULE_ID` in .env)     |
| `tabid`                     | `88` (DNN portal tab ID, from `TAB_ID` in .env)            |
| `Referer`                   | `https://water-billing.ottawa.ca/en-ca/my-account/usage`   |

**Response Shape (`Success: true`):**
```json
{
  "Success": true,
  "Data": {
    "hourlyUsages": [
      { "axisX": "1 AM", "axisY": 0.0,   "date": null, "tag": null },
      { "axisX": "8 AM", "axisY": 0.046, "date": null, "tag": null }
    ],
    "dailyUsages": null,
    "readings": null,
    "showGraphicChart": true,
    "serviceDescSelected": "Water",
    "serviceUnitSelected": null
  },
  "Exception": null,
  "Feedback": null,
  "StatusDescription": null
}
```

**Schema Mapping → `water_usage` table:**
| API Field         | DB Column     | Notes                             |
|-------------------|---------------|-----------------------------------|
| query param `date`| `date`        | YYYY-MM-DD                        |
| `axisX`           | `hour_label`  | e.g. "8 AM", "6 PM"              |
| `axisY`           | `usage_m3`    | Float, cubic metres               |

**Important Notes:**
- Portal uses **DotNetNuke (DNN)** + **Shibboleth SAML** authentication.
- Primary session identifiers: `mysoauth`, `.DOTNETNUKE`, `ASP.NET_SessionId`.
- `__RequestVerificationToken` cookie value is also sent as the `RequestVerificationToken` header (DNN double-submit CSRF pattern).
- `moduleid` (480) and `tabid` (88) are DNN page-routing identifiers — may change if portal is restructured.
- A **daily usage** endpoint is also visible in DevTools (`GetDailyUsage`) — to be documented in Phase 3.

---

## 🌤️ Open-Meteo Historical Weather API — Confirmed (2026-03-05)

- **Endpoint:** `https://archive-api.open-meteo.com/v1/archive`
- **Coordinates for Ottawa, Ontario:** `Lat: 45.4215, Long: -75.6972`
- **Timezone:** `America/Toronto`
- **Variables fetched:** `temperature_2m_max`, `temperature_2m_mean`, `relative_humidity_2m_mean`
- **No API key required.** Free tier is sufficient for daily scraping.
- **Schema Mapping → `weather_log` table:**
  - `temperature_2m_max` → `max_temp`
  - `temperature_2m_mean` → `mean_temp`
  - `relative_humidity_2m_mean` → `avg_humidity`

---

## 🤖 Automating Ottawa Portal Authentication (Puppeteer)

The Ottawa Water portal sits behind Azure AD B2C or Shibboleth constraints. Attempting raw HTTP `POST /login` requests usually fails due to embedded anti-bot tokens or deeply nested redirects.
Instead, we will use `puppeteer` to automate an actual Chromium browser session:
1. Navigate to the login page.
2. Fill the form with standard DOM selectors (email, password).
3. Submit and wait for network idle/navigation.
4. Extract the `Cookie` header from a successful XHR request to `GetHourlyUsage`.
5. Write the extracted string back to the local `.env` file via Node's `fs` module, enabling the lightweight scraper services to run uninterrupted.
