const express = require('express');
const fetch = require('node-fetch');
const app = express();

// Middleware: parse JSON
app.use(express.json());

// CORS Middleware for frontend
app.use((req, res, next) => {
  const allowedOrigin = 'https://venerable-concha-0f56d5.netlify.app';
  const origin = req.headers.origin;
  if (origin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check
app.get('/', (req, res) => res.json({ message: 'Server is running' }));

// Configuration
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';
const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

if (!LINE_ACCESS_TOKEN || !APPS_SCRIPT_URL) {
  console.error('Error: Missing environment variables');
  process.exit(1);
}

// === /submit Route ===
app.post('/submit', async (req, res) => {
  const data = req.body;
  console.log('[/submit] payload:', data);

  try {
    // Step 1: Save to Google Sheet via Apps Script
    const saveResponse = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const saveResult = await saveResponse.json();
    console.log('[/submit] Apps Script response:', saveResponse.status, saveResult);

    if (!saveResponse.ok || saveResult.result !== 'success') {
      return res.status(500).json({ error: 'Failed to save data' });
    }

    // Step 2: Send LINE push message
    const payload = {
      to: data.userId,
      messages: [
        {
          type: 'text',
          text: 'แจ้งซ่อมสำเร็จ\nอุปกรณ์: ' + data.problem + '\nสถานะ: รอซ่อม'
        }
      ]
    };

    console.log('[/submit] Sending push payload:', JSON.stringify(payload));

    const pushResponse = await fetch(LINE_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    const pushResult = await pushResponse.json();
    console.log('[/submit] LINE API response:', pushResponse.status, pushResult);

    if (!pushResponse.ok) {
      return res.status(pushResponse.status).json({ error: 'LINE push failed', pushResult });
    }

    res.status(200).json({ message: 'Data saved and LINE push sent', saveResult, pushResult });
  } catch (err) {
    console.error('[/submit] Error:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
