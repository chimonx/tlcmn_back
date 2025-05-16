const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const { middleware: lineMiddleware, Client: LineClient } = require('@line/bot-sdk');
const app = express();

app.use(bodyParser.json());

// ===== CORS Middleware (for frontend) =====
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

// ===== Health Check =====
app.get('/', (req, res) => {
  res.json({ message: 'Server is running' });
});

// ===== Configuration =====
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzjgzSUqhlVun7gNVzCFdlnTe4LmkVkO8AYj96I7-H2CqMZWbMMCIyMd8TbnW75UA/exec';
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN || 'ISywuMtcI1v0jSuRd9fWAWCXHkTxR7gkC2+oJwlwOhnlHaPlmQnQdSbUHcjSfs/tWnJTPGx/YVafbSgsu1jAblC1+IOR3sliuoFJ6bo0MDLD3kJalyHRoq5A+Q3qpOEwgL9YAmckowC4EZK8JW7zzQdB04t89/1O/w1cDnyilFU=';
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || 'fd105f2a9a6f59e554976f3bcaa6b8c4';

const lineConfig = {
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: LINE_CHANNEL_SECRET
};

const lineClient = new LineClient(lineConfig);

// ===== /submit Route for Frontend =====
app.post('/submit', async (req, res) => {
  console.log('Received data from frontend:', req.body);

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const result = await response.json();
    console.log('Apps Script response:', result);

    if (response.ok && result.result === 'success') {
      return res.status(200).json({ result: 'success' });
    } else {
      return res.status(500).json({ result: 'error', message: 'Google Apps Script error or invalid response' });
    }
  } catch (error) {
    console.error('Error in /submit:', error);
    return res.status(500).json({ result: 'error', message: error.toString() });
  }
});

// ===== /line-webhook from LINE Platform =====
app.post(
  '/line-webhook',
  lineMiddleware(lineConfig),  // Signature verification
  (req, res) => {
    // ตอบกลับทันที
    res.status(200).send('OK');

    // ประมวลผลใน background
    setImmediate(async () => {
      const events = req.body.events;
      if (!events || events.length === 0) return;

      for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
          const userMessage = event.message.text;
          const userId = event.source.userId;

          // เตรียมข้อความตอบกลับ
          const replyMessages = [
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
                  type: 'box',
                  layout: 'vertical',
                  contents: [
                    { type: 'text', text: 'แจ้งซ่อมสำเร็จ', weight: 'bold', size: 'xl' },
                    { type: 'text', text: `อุปกรณ์: ${userMessage}`, size: 'sm', color: '#666666', margin: 'md' },
                    { type: 'text', text: 'สถานะ: รอซ่อม', size: 'sm', color: '#AAAAAA', margin: 'sm' }
                  ]
                }
              }
            }
          ];

          // ส่งผ่าน Reply API
          try {
            await lineClient.replyMessage(event.replyToken, replyMessages);
            console.log('Replied to user:', userId);
          } catch (err) {
            console.error('Failed to reply:', err);
          }

          // ส่งข้อมูลไป Google Sheets
          const sheetData = {
            userId,
            message: userMessage,
            status: 'รอซ่อม',
            timestamp: new Date().toISOString()
          };

          try {
            const saveRes = await fetch(APPS_SCRIPT_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(sheetData)
            });
            const saveResult = await saveRes.json();
            console.log('Saved to Google Sheet:', saveResult);
          } catch (err) {
            console.error('Failed to save to Google Sheet:', err);
          }
        }
      }
    });
  }
);

// ===== Start Server =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
