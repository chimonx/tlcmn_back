const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
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
  res.json({ message: "Server is running" });
});

// ===== Configuration =====
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzjgzSUqhlVun7gNVzCFdlnTe4LmkVkO8AYj96I7-H2CqMZWbMMCIyMd8TbnW75UA/exec";
const LINE_ACCESS_TOKEN = 'ISywuMtcI1v0jSuRd9fWAWCXHkTxR7gkC2+oJwlwOhnlHaPlmQnQdSbUHcjSfs/tWnJTPGx/YVafbSgsu1jAblC1+IOR3sliuoFJ6bo0MDLD3kJalyHRoq5A+Q3qpOEwgL9YAmckowC4EZK8JW7zzQdB04t89/1O/w1cDnyilFU=';

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
app.post('/line-webhook', async (req, res) => {
  const events = req.body.events;

  if (!events || events.length === 0) {
    console.log('No events received');
    return res.status(200).send('No event');
  }

  for (const event of events) {
    console.log('Received event:', event);

    if (event.type === 'message' && event.message.type === 'text') {
      const userMessage = event.message.text;
      const userId = event.source.userId;

      console.log('User ID:', userId);
      console.log('User message:', userMessage);

      const messages = [
        {
          type: "text",
          text: "คุณได้แจ้งซ่อมเรียบร้อยแล้ว"
        },
        {
          type: "flex",
          altText: "แจ้งซ่อมสำเร็จ",
          contents: {
            type: "bubble",
            hero: {
              type: "image",
              url: "https://scdn.line-apps.com/n/channel_devcenter/img/fx/01_4_car.png",
              size: "full",
              aspectRatio: "20:13",
              aspectMode: "cover"
            },
            body: {
              type: "box",
              layout: "vertical",
              contents: [
                {
                  type: "text",
                  text: "แจ้งซ่อมสำเร็จ",
                  weight: "bold",
                  size: "xl"
                },
                {
                  type: "text",
                  text: `อุปกรณ์: ${userMessage}`,
                  size: "sm",
                  color: "#666666",
                  margin: "md"
                },
                {
                  type: "text",
                  text: `สถานะ: รอซ่อม`,
                  size: "sm",
                  color: "#AAAAAA",
                  margin: "sm"
                }
              ]
            }
          }
        }
      ];

      try {
        // === Step 1: Send push message to LINE user ===
        const pushResponse = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
            // ลบ X-Line-Retry-Key ออกชั่วคราวเพื่อทดสอบ
          },
          body: JSON.stringify({
            to: userId,
            messages: messages
          })
        });

        const pushText = await pushResponse.text();
        console.log('Push message response:', pushResponse.status, pushText);

        if (!pushResponse.ok) {
          console.error('Failed to send push message');
          continue; // ข้าม event นี้
        }

        // === Step 2: Save data to Google Sheet via Apps Script ===
        const requestData = {
          userId: userId,
          message: userMessage,
          status: "รอซ่อม",
          timestamp: new Date().toISOString()
        };

        const response = await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        });

        const result = await response.json();
        console.log('Saved to Google Sheet:', result);

        if (!(response.ok && result.result === 'success')) {
          console.error('Failed to save to Google Sheet');
        }

      } catch (error) {
        console.error("Error handling LINE webhook:", error);
      }
    }
  }

  res.status(200).send('OK');
});

// ===== Start Server =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
