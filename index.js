const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch'); // ถ้า Node <18 ต้องติดตั้ง: npm i node-fetch@2
const app = express();

app.use(bodyParser.json());

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyA75rchBrF8YSyc9bQVaqoya7kCBVqV6iXxjLlvbOXnGoBXJLdEbddcwXOc5U-2A/exec";

app.post('/submit', async (req, res) => {
  try {
    // รับข้อมูลจาก LIFF frontend
    const data = req.body;

    // ส่งข้อมูลต่อไปยัง Google Apps Script Web App
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
