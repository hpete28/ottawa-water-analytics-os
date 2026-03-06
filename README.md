# 💧 Ottawa Water Analytics OS

A full-stack local web application designed to automatically scrape the Ottawa Water Portal, correlate household consumption against real-world weather patterns (Open-Meteo), and utilize Google Gemini AI to analyze environmental impacts (like Humidifiers) on utility usage.

## 🚀 Features
- **Data Governance:** 100% self-hosted local SQLite database (`water_analytics.db`).
- **Headless Automation:** Puppeteer invisibly intercepts Azure AD B2C portal logins when cookies expire, stealing valid session tokens to keep the scraper running indefinitely.
- **Unified Dashboard:** Beautiful real-time graphing built on Vite + React + TailwindCSS + Recharts.
- **AI Insights:** Native `@google/generative-ai` integration correlates consumption spikes with humidity and temperature drops.

---

## 🛠️ Installation & Setup

### 1. Requirements
- Node.js (v18+)
- NPM

### 2. Environment Variables
You must configure the `.env` file at the root of the project:
```env
# Server
PORT=3001

# AI Insights (Grab a free key from Google AI Studio)
GEMINI_API_KEY=AIzaSyDBg0zo... 

# Automated Scrape Login (Required for headless AuthScraper.js)
OTTAWA_EMAIL=your_email_here
OTTAWA_PASSWORD=your_password_here
```

### 3. Install Dependencies
Install both the backend and frontend package dependencies:
```bash
npm install
cd frontend && npm install
cd ..
```

---

## ⚡ Running the App
The application contains an Express Backend (port 3001) and a React Frontend (built to `frontend/dist`).

**To start the production server:**
```bash
npm start
```
*The Express server will automatically serve the React frontend at `http://localhost:3001` or your Tailscale IP.*

---

## 🐙 Uploading to GitHub
Since `.gitignore` protects your database and your `.env` credentials, it is safe to upload this project to a public or private GitHub repository for version control.

1. Go to [GitHub](https://github.com/) and create a new empty repository (do not add a README or `.gitignore` through the web UI).
2. Open Powershell or VS Code terminal in the root `Water_Analytics_OS` folder.
3. Run the following commands:
```bash
git init
git add .
git commit -m "Initial commit: Ottawa Water Analytics Dashboard with Headless Auth & AI Insights"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/YOUR_NEW_REPO_NAME.git
git push -u origin main
```
Whenever you make future updates, you can simply run:
```bash
git add .
git commit -m "Describe your changes"
git push
```
