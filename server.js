require('dotenv').config();
const express = require('express');
const { OpenAI } = require('openai');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const FormData = require('form-data');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload = multer({ dest: '/tmp/uploads/' });
const calls = [];

async function transcribeAudio(filePath) {
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));
  formData.append('model', 'whisper-1');
  formData.append('language', 'he');
  const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
    headers: { ...formData.getHeaders(), Authorization: 'Bearer ' + process.env.OPENAI_API_KEY }
  });
  return response.data.text;
}

async function analyzeCall(transcript) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are an assistant for a pest control business. Extract from transcript: customer name, address, problem type, agreed price, visit date. Reply ONLY in Hebrew.' },
      { role: 'user', content: 'Transcript: ' + transcript }
    ]
  });
  return completion.choices[0].message.content;
}

async function sendWhatsApp(message) {
  const owner = process.env.OWNER_WHATSAPP;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || !owner) return;
  await axios.post(
    'https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json',
    new URLSearchParams({ From: 'whatsapp:+14155238886', To: 'whatsapp:+' + owner, Body: message }),
    { auth: { username: sid, password: token } }
  );
}

app.post('/upload-recording', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file' });
    const filePath = req.file.path;
    console.log('Received recording:', req.file.originalname);
    const transcript = await transcribeAudio(filePath);
    const analysis = await analyzeCall(transcript);
    const callData = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      transcript,
      analysis,
      phone: req.body.phone || 'unknown'
    };
    calls.unshift(callData);
    if (calls.length > 100) calls.pop();
    const msg = 'שיחה חדשה!\n' + analysis + '\n\nמספר: ' + callData.phone;
    await sendWhatsApp(msg);
    fs.unlinkSync(filePath);
    res.json({ success: true, analysis });
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/calls', (req, res) => res.json(calls));
app.get('/health', (req, res) => res.json({ status: 'ok', calls: calls.length }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server on port ' + PORT));
