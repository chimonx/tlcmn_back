const express = require('express');
const fetch = require('node-fetch');
const { middleware: lineMiddleware } = require('@line/bot-sdk');
const app = express();

// LINE raw body parser for signature verification
app.use('/line-webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

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
app.get('/', (req, res) => res.json({ message: 'OK' }));

// Configuration
const APPS_SCRIPT_URL = 'https://script.google.com/macros/u/2/s/AKfycbzjgzSUqhlVun7gNVzCFdlnTe4LmkVkO8AYj96I7-H2CqMZWbMMCIyMd8TbnW75UA/exec';
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';
const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN; // Set in env

// Submit data from frontend
app.post('/submit', async (req, res) => {
  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const json = await resp.json();
    res.status(resp.ok && json.result === 'success' ? 200 : 500).json(json);
  } catch (e) {
    console.error('Submit error:', e);
    res.status(500).json({ error: e.message });
  }
});

// LINE webhook
app.post('/line-webhook', lineMiddleware({ channelAccessToken: LINE_ACCESS_TOKEN, channelSecret: process.env.LINE_CHANNEL_SECRET }), (req, res) => {
  // Immediately reply HTTP 200 to LINE
  res.sendStatus(200);

  // Parse events
  const bodyString = req.body.toString('utf8');
  let events;
  try {
    events = JSON.parse(bodyString).events;
  } catch (e) {
    console.error('JSON parse error:', e);
    return;
  }
  if (!Array.isArray(events) || events.length === 0) return;

  // Process each event in background
  events.forEach(async (event) => {
    if (event.type === 'message' && event.message.type === 'text') {
      const userId = event.source.userId;
      const userMessage = event.message.text;

      // Prepare push payload
      const pushBody = {
        to: userId,
        messages: [
          { type: 'text', text: 'คุณได้แจ้งซ่อมเรียบร้อยแล้ว' },
          {
            type: 'flex',
            altText: 'แจ้งซ่อมสำเร็จ',
            contents: {
              type: 'bubble',
              hero: {
                type: 'image',
                url: 'https://scdn.line-apps.com/n/channel_devcenter/img/fx/01_4_car.png',
                size: 'full',
                aspectRatio: '20:13',
                aspectMode: 'cover'
              },
              body: {
                type: 'box', layout: 'vertical', contents: [
                  { type: 'text', text: 'แจ้งซ่อมสำเร็จ', weight: 'bold', size: 'xl' },
                  { type: 'text', text: `อุปกรณ์: ${userMessage}`, size: 'sm', color: '#666', margin: 'md' },
                  { type: 'text', text: 'สถานะ: รอซ่อม', size: 'sm', color: '#AAA', margin: 'sm' }
                ]
              }
            }
          }
        ]
      };

      // Send push message via HTTP request
      try {
        const pushResp = await fetch(LINE_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
          },
          body: JSON.stringify(pushBody)
        });
        const pushJson = await pushResp.json();
        console.log('Push API response:', pushResp.status, pushJson);
      } catch (err) {
        console.error('Push message error:', err);
      }

      // Save to Google Sheet
      try {
        await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, message: userMessage, status: 'รอซ่อม', timestamp: new Date().toISOString() })
        });
      } catch (err) {
        console.error('Sheet save error:', err);
      }
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (req.path === '/line-webhook') return res.sendStatus(200);
  res.status(500).json({ error: 'Server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
