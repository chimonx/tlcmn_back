const express = require('express');
const fetch = require('node-fetch');
const app = express();

// Middleware: parse raw body for LINE, JSON for others
app.use('/line-webhook', express.raw({ type: 'application/json' }));
app.use((req, res, next) => {
  if (req.path !== '/line-webhook') {
    express.json()(req, res, next);
  } else {
    next();
  }
});

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
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzjgzSUqhlVun7gNVzCFdlnTe4LmkVkO8AYj96I7-H2CqMZWbMMCIyMd8TbnW75UA/exec';
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';
const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
if (!LINE_ACCESS_TOKEN) {
  console.error('Error: Missing LINE_ACCESS_TOKEN');
  process.exit(1);
}

// === /submit Route for Frontend ===
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
      return res.status(200).json(json);
    }
    console.error('[/submit] Apps Script failure:', json);
    return res.status(500).json({ error: 'Apps Script failure', details: json });
  } catch (e) {
    console.error('[/submit] error:', e);
    return res.status(500).json({ error: 'Internal Server Error', message: e.message });
  }
});

// === /line-webhook Route ===
app.post('/line-webhook', (req, res) => {
  // Log incoming webhook info
  console.log('[LINE] Headers:', JSON.stringify(req.headers));
  console.log('[LINE] Raw body buffer length:', req.body.length);
  const raw = req.body.toString('utf8');
  console.log('[LINE] Raw body string:', raw);
  let body;
  try {
    body = JSON.parse(raw);
    console.log('[LINE] Parsed body:', JSON.stringify(body));
  } catch (err) {
    console.error('[LINE] JSON parse error:', err);
    return res.sendStatus(400);
  }

  // Acknowledge webhook immediately
  res.sendStatus(200);

  const events = Array.isArray(body.events) ? body.events : [];
  console.log(`[LINE] Events count: ${events.length}`);

  events.forEach(async event => {
    console.log('[LINE] Event:', JSON.stringify(event));
    if (event.type === 'message' && event.message.type === 'text') {
      const userId = event.source.userId;
      const userMsg = event.message.text;

      // Push message payload
      const payload = {
        to: userId,
        messages: [
          { type: 'text', text: 'คุณได้แจ้งซ่อมเรียบร้อยแล้ว' },
          { type: 'text', text: `อุปกรณ์: ${userMsg}\nสถานะ: รอซ่อม` }
        ]
      };
      console.log('[LINE] Push payload:', JSON.stringify(payload));

      try {
        const response = await fetch(LINE_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
          },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        console.log('[LINE] Push API response:', response.status, JSON.stringify(result));
      } catch (err) {
        console.error('[LINE] Push API error:', err);
      }

      // Save to sheet
      try {
        const sheetResp = await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, message: userMsg, status: 'รอซ่อม', timestamp: new Date().toISOString() })
        });
        console.log('[Sheet] Save status:', sheetResp.status);
      } catch (err) {
        console.error('[Sheet] save error:', err);
      }
    }
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
