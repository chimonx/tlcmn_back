const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const app = express();

app.use(bodyParser.json());

// ===== CORS Middleware =====
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

// ===== Health Check Route =====
app.get('/', (req, res) => {
  res.json({ message: "Server is running" });
});

// ===== Google Apps Script URL =====
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzjgzSUqhlVun7gNVzCFdlnTe4LmkVkO8AYj96I7-H2CqMZWbMMCIyMd8TbnW75UA/exec";

// ===== LINE Access Token =====
const LINE_ACCESS_TOKEN = 'YOUR_LINE_ACCESS_TOKEN'; // <-- เปลี่ยนเป็น Token จริงของคุณ

// ===== LINE Webhook Endpoint =====
app.post('/line-webhook', async (req, res) => {
  const events = req.body.events;

  if (!events || events.length === 0) {
    return res.status(200).send('No event');
  }

  for (const event of events) {
    if (event.type === 'message' && event.message.type === 'text') {
      const userMessage = event.message.text;
      const replyToken = event.replyToken;
      const userId = event.source.userId;

      // === Step 1: Prepare Data to Save to Google Sheet ===
      const requestData = {
        userId: userId,
        message: userMessage,
        status: "รอซ่อม",
        timestamp: new Date().toISOString()
      };

      try {
        // === Step 2: Save to Google Sheets ===
        const response = await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        });

        const result = await response.json();
        console.log('Saved to Google Sheets:', result);

        // === Step 3: Reply Flex Message Only If Save Successful ===
        if (result.result === 'success') {
          const flexMessage = {
            type: "flex",
            altText: "คุณได้แจ้งซ่อมเรียบร้อยแล้ว",
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
          };

          // === Step 4: Send Flex Message to LINE ===
          await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
              replyToken: replyToken,
              messages: [flexMessage]
            })
          });
        }

      } catch (error) {
        console.error("Error saving to Sheets or replying to LINE:", error);
      }
    }
  }

  // Always reply 200 to LINE
  res.status(200).send('OK');
});

// ===== Start Server =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
