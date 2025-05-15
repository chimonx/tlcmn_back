const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const app = express();

app.use(bodyParser.json());

// CORS middleware
app.use((req, res, next) => {
  const allowedOrigin = 'https://venerable-concha-0f56d5.netlify.app';
  const origin = req.headers.origin;

  if (origin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Route for health check
app.get('/', (req, res) => {
  res.json({ message: "Server is running" });
});

// Google Apps Script URL
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzjgzSUqhlVun7gNVzCFdlnTe4LmkVkO8AYj96I7-H2CqMZWbMMCIyMd8TbnW75UA/exec";

app.post('/submit', async (req, res) => {
  console.log('Received data:', req.body);

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
