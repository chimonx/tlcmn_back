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
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzjgzSUqhlVun7gNVzCFdlnTe4LmkVkO8AYj96I7-H2CqMZWbMMCIyMd8TbnW75UA/exec';
const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
if (!LINE_ACCESS_TOKEN) {
  console.error('Error: Missing LINE_ACCESS_TOKEN');
  process.exit(1);
}

// === /submit Route ===
app.post('/submit', async (req, res) => {
  console.log('[/submit] payload:', req.body);
  const { userId, displayName, building, floor, department, problem } = req.body;

  if (!userId || !problem) {
    return res.status(400).json({ error: 'Missing userId or problem' });
  }

  const sheetData = {
    userId,
    displayName,
    building,
    floor,
    department,
    problem,
    status: 'รอซ่อม',
    timestamp: new Date().toISOString()
  };

  try {
    // ส่งข้อมูลไป Google Apps Script เพื่อบันทึกลง Sheet
    const sheetRes = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sheetData)
    });

    const sheetResult = await sheetRes.json();
    console.log('[/submit] Apps Script response:', sheetRes.status, sheetResult);

    if (sheetRes.ok && sheetResult.result === 'success') {
      // เตรียม Flex Message ส่งกลับ
      const flexMessage = {
        type: 'flex',
        altText: 'แจ้งซ่อม',
        contents: {
          type: 'bubble',
          hero: {
            type: 'image',
            url: 'https://img5.pic.in.th/file/secure-sv1/S__20308020.png',
            size: 'full',
            aspectRatio: '20:13',
            aspectMode: 'cover'
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: 'แจ้งซ่อม', weight: 'bold', size: 'xl' },
              {
                type: 'box',
                layout: 'vertical',
                margin: 'md',
                spacing: 'sm',
                contents: [
                  {
                    type: 'box',
                    layout: 'baseline',
                    spacing: 'sm',
                    contents: [
                      { type: 'text', text: 'ปัญหา', color: '#aaaaaa', size: 'sm', flex: 2 },
                      { type: 'text', text: problem, wrap: true, color: '#666666', size: 'sm', flex: 5 }
                    ]
                  },
                  {
                    type: 'box',
                    layout: 'baseline',
                    spacing: 'sm',
                    contents: [
                      { type: 'text', text: 'ตึก', color: '#aaaaaa', size: 'sm', flex: 2 },
                      { type: 'text', text: building || '-', wrap: true, color: '#666666', size: 'sm', flex: 5 }
                    ]
                  },
                  {
                    type: 'box',
                    layout: 'baseline',
                    spacing: 'sm',
                    contents: [
                      { type: 'text', text: 'ชั้น', color: '#aaaaaa', size: 'sm', flex: 2 },
                      { type: 'text', text: floor || '-', wrap: true, color: '#666666', size: 'sm', flex: 5 }
                    ]
                  },
                  {
                    type: 'box',
                    layout: 'baseline',
                    spacing: 'sm',
                    contents: [
                      { type: 'text', text: 'ผู้แจ้ง', color: '#aaaaaa', size: 'sm', flex: 2 },
                      { type: 'text', text: displayName || '-', wrap: true, color: '#666666', size: 'sm', flex: 5 }
                    ]
                  },
                  {
                    type: 'box',
                    layout: 'baseline',
                    spacing: 'sm',
                    contents: [
                      { type: 'text', text: 'สถานะ', color: '#aaaaaa', size: 'sm', flex: 2 },
                      { type: 'text', text: 'รอซ่อม', wrap: true, color: '#666666', size: 'sm', flex: 5 }
                    ]
                  }
                ]
              }
            ]
          }
        }
      };

      const pushPayload = {
        to: userId,
          messages: [flexMessage]
};


      // ส่ง push message กลับไปที่ userId
      const pushRes = await fetch(LINE_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`
        },
        body: JSON.stringify(pushPayload)
      });

      const pushResult = await pushRes.json();
      console.log('[/submit] LINE push response:', pushRes.status, pushResult);

      if (pushRes.ok) {
        return res.status(200).json({ message: 'Data saved successfully', status: 'success' });
      } else {
        return res.status(pushRes.status).json({ error: 'Push failed', pushResult });
      }
    } else {
      return res.status(500).json({ error: 'Failed to save to Google Sheet', sheetResult });
    }
  } catch (err) {
    console.error('[/submit] error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
