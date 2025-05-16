const express = require('express');
const fetch = require('node-fetch');
const { middleware: lineMiddleware, Client: LineClient } = require('@line/bot-sdk');
const app = express();

// LINE requires raw body for signature verification
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

// Config
const APPS_SCRIPT_URL = 'https://script.google.com/macros/u/2/s/AKfycbzjgzSUqhlVun7gNVzCFdlnTe4LmkVkO8AYj96I7-H2CqMZWbMMCIyMd8TbnW75UA/exec';
const lineConfig = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const lineClient = new LineClient(lineConfig);

// Submit from frontend
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
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// LINE webhook
app.post('/line-webhook', lineMiddleware(lineConfig), (req, res) => {
  res.sendStatus(200);
  const events = JSON.parse(req.body.toString()).events;
  if (!events.length) return;
  events.forEach(async event => {
    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text;
      const userId = event.source.userId;
      const messages = [
        { type: 'text', text: 'คุณได้แจ้งซ่อมเรียบร้อยแล้ว' },
        {
          type: 'flex', altText: 'แจ้งซ่อมสำเร็จ',
          contents: {
            type: 'bubble',
            hero: { type: 'image', url: 'https://scdn.line-apps.com/n/channel_devcenter/img/fx/01_4_car.png', size: 'full', aspectRatio: '20:13', aspectMode: 'cover' },
            body: { type: 'box', layout: 'vertical', contents: [
              { type: 'text', text: 'แจ้งซ่อมสำเร็จ', weight: 'bold', size: 'xl' },
              { type: 'text', text: `อุปกรณ์: ${text}`, size: 'sm', color: '#666' },
              { type: 'text', text: 'สถานะ: รอซ่อม', size: 'sm', color: '#AAA' }
            ] }
          }
        }
      ];
      try {
        await lineClient.pushMessage(userId, messages);
        await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, message: text, status: 'รอซ่อม', timestamp: new Date().toISOString() })
        });
      } catch (err) {
        console.error(err);
      }
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (req.path === '/line-webhook') return res.sendStatus(200);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening ${PORT}`));
