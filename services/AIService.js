const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * services/AIService.js
 * ---------------------
 * Handles communication with the Google Gemini API to analyze water usage data.
 */

async function analyzeWaterData(startDate, endDate, waterLog, weatherLog) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your_key_here') {
        throw new Error('GEMINI_API_KEY is missing or invalid in .env file. Please add your API key to enable AI Insights.');
    }

    // Use the recommended model for general text/reasoning tasks
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Merge the water and weather data by date so the AI can see the correlations easily
    const mergedDataMap = new Map();

    for (const { date, max_temp, mean_temp, avg_humidity } of weatherLog) {
        mergedDataMap.set(date, { date, maxTemp: max_temp, meanTemp: mean_temp, avgHumidity: avg_humidity, consumption: 0 });
    }

    for (const { date, daily_total } of waterLog) {
        if (mergedDataMap.has(date)) {
            mergedDataMap.get(date).consumption = daily_total;
        } else {
            mergedDataMap.set(date, { date, consumption: daily_total, maxTemp: null, meanTemp: null, avgHumidity: null });
        }
    }

    const sortedData = Array.from(mergedDataMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Convert the structured data to a clean CSV/JSON-like string for the prompt
    const dataString = sortedData.map(d =>
        `Date: ${d.date} | Water: ${d.consumption ? d.consumption.toFixed(3) : '0.000'} m³ | Max Temp: ${d.maxTemp}°C | Mean Temp: ${d.meanTemp}°C | Avg Humidity: ${d.avgHumidity}%`
    ).join('\n');

    const prompt = `
You are an expert data analyst and home utility consultant.
I am providing you with daily data for my house in Ottawa, Canada, spanning from ${startDate} to ${endDate}.
The data includes my daily water consumption (in cubic meters), maximum temperature, mean temperature, and average humidity.

I recently installed a humidifier in my house, and I want to know how much water it is using and how it is affecting my total water consumption.

Here is the data:
${dataString}

Please analyze this data and provide a concise, actionable report in Markdown format.
Focus specifically on:
1. **The Humidifier Impact:** Is there a clear correlation between drops in humidity/temperature and spikes in my water usage? Can you estimate roughly how much water the humidifier uses on a very dry/cold day compared to a mild day?
2. **General Trends:** Any other notable patterns in my water usage?
3. **Anomalies:** Point out any days that look unusually high or low.

Keep your response professional, insightful, and formatted with clear headings, bold text for key metrics, and bullet points. Do not include raw data dumps in your response.
`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        throw new Error('Failed to generate AI insights. Please check the backend logs or your API key.');
    }
}

module.exports = { analyzeWaterData };
