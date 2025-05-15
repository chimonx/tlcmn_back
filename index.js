const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const app = express();

app.use(bodyParser.json());

// เพิ่ม middleware สำหรับจัดการ CORS
app.use((req, res, next) => {
  const allowedOrigin = 'https://peppy-tartufo-42fc69.netlify.app';
  const origin = req.headers.origin;

  if (origin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  // สำหรับ preflight request (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyA75rchBrF8YSyc9bQVaqoya7kCBVqV6iXxjLlvbOXnGoBXJLdEbddcwXOc5U-2A/exec";

app.post('/submit', async (req, res) => {
  try {
    const data = req.body;

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (response.ok && result.result === 'success') {
      res.status(200).json({ result: 'success' });
    } else {
      res.status(500).json({ result: 'error', message: 'Google Apps Script error or invalid response' });
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ result: 'error', message: error.toString() });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
