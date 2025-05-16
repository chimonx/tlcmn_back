const express = require('express');
const fetch = require('node-fetch');
const { middleware: lineMiddleware } = require('@line/bot-sdk');
const app = express();

// Middleware: parse JSON for all routes except raw for LINE
app.use(express.json());
app.use('/line-webhook', express.raw({ type: 'application/json' }));

// CORS for frontend
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin === 'https://venerable-concha-0f56d5.netlify.app') {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Health check
app.get('/', (req, res) => res.json({ message: 'Server is running' }));

// Configuration: replace with your actual Apps Script URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzjgzSUqhlVun7gNVzCFdlnTe4LmkVkO8AYj96I7-H2CqMZWbMMCIyMd8TbnW75UA/exec';
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';
const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
if (!LINE_ACCESS_TOKEN) {
  console.error('Missing LINE_ACCESS_TOKEN env var');
}

// Route: /submit from frontend
app.post('/submit', async (req, res) => {
  console.log('[/submit] payload:', req.body);
  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const json = await resp.json();
    console.log('[/submit] Apps Script response:', resp.status, json);
    if (resp.ok && json.result === 'success') {
      res.status(200).json(json);
    } else {
      console.error('[/submit] error response from Apps Script');
      res.status(500).json({ error: 'Apps Script failure', details: json });
    }
  } catch (e) {
    console.error('[/submit] fetch error:', e);
    res.status(500).json({ error: 'Internal Server Error', message: e.message });
  }
});

// Route: LINE webhook
app.post(
  '/line-webhook',
  lineMiddleware({
    channelAccessToken: LINE_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET
  }),
  (req, res) => {
    res.sendStatus(200);
    let events;
    try {
      events = JSON.parse(req.body.toString('utf8')).events;
    } catch (err) {
      return console.error('Failed to parse webhook body:', err);
    }
    if (!Array.isArray(events) || events.length === 0) return;

    events.forEach(async (event) => {
      if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId;
        const userMsg = event.message.text;

        // Send push message (replace Flex with plain text)
        const pushPayload = {
          to: userId,
          messages: [
            { type: 'text', text: 'คุณได้แจ้งซ่อมเรียบร้อยแล้ว' },
            { type: 'text', text: `อุปกรณ์: ${userMsg}\nสถานะ: รอซ่อม` }
          ]
        };

        try {
          const pushResp = await fetch(LINE_PUSH_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
            },
            body: JSON.stringify(pushPayload)
          });
          const pushJson = await pushResp.json();
          console.log('Push API response:', pushResp.status, pushJson);
        } catch (err) {
          console.error('Push API error:', err);
        }

        // Save to Google Sheet
        try {
          const sheetResp = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, message: userMsg, status: 'รอซ่อม', timestamp: new Date().toISOString() })
          });
          console.log('Sheet save status:', sheetResp.status);
        } catch (err) {
          console.error('Sheet save error:', err);
        }
      }
    });
  }
);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (req.path === '/line-webhook') return res.sendStatus(200);
  res.status(500).json({ error: 'Server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
