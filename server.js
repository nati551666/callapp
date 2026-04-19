require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const { OpenAI } = require('openai');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const activeCalls = {};
const callHistory = [];

app.post('/incoming-call', (req, res) => {
    const callSid = req.body.CallSid;
    const callerNumber = req.body.From;
    console.log(`Incoming call from ${callerNumber}, SID: ${callSid}`);
    activeCalls[callSid] = { sid: callSid, caller: callerNumber, startTime: new Date(), recordingUrl: null, transcript: null, analysis: null };
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ language: 'he-IL', voice: 'Polly.Ayelet' }, 'שלום, הגעתם לשירות איטום והדברה. אנא המתינו להתחברות.');
    const dial = twiml.dial({
          record: 'record-from-ringing',
          recordingStatusCallback: `https://server-production-eca3.up.railway.app/recording-complete`,
          recordingStatusCallbackMethod: 'POST',
          action: `https://server-production-eca3.up.railway.app/call-complete`,
          timeout: 30
    });
    dial.nut(`${recordingUrl}.mp3`, {
            auth: { username: process.env.TWILIO_ACCOUNT_SID, password: process.env.TWILIO_AUTH_TOKEN },
            responseType: 'arraybuffer'
    });
      const audioBuffer = Buffer.from(recordingResponse.data);
      const { Readable } = require('stream');
      const stream = Readable.from(audioBuffer);
      stream.path = 'recording.mp3';
      const transcription = await openai.audio.transcriptions.create({ file: stream, model: 'whisper-1', language: 'he', response_format: 'text' });
      console.log(`Transcript: ${transcription}`);
      const analysis = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [{
                        role: 'system',
                        content: 'אתה עוזר לעסק של איטום והדברה. נתח את השיחה וחלץ פרטים בפורמט JSON: {"customerName":"","customerPhone":"","address":"","problemType":"","agreedPrice":"","visitDate":"","summary":"","followUp":""}'
              }, { role: 'user', content: transcription }],
              response_format: { type: 'json_object' }
      });
      const analysisData = JSON.parse(analysis.choices[0].message.content);
      if (activeCalls[callSid]) {
              activeCalls[callSid].transcript = transcription;
              activeCalls[callSid].analysis = analysisData;
              activeCalls[callSid].endTime = new Date();
              callHistory.unshift(activeCalls[callSid]);
      }
      await sendWhatsAppNotification(activeCalls[callSid]);
} catch (error) { console.error('Error:', error.message); }
  res.sendStatus(200);
});

app.post('/call-complete', (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
    res.type('text/xml');
    res.send(twiml.toString());
});

async function sendWhatsAppNotification(callData) {
    try {
          const a = callData.analysis || {};
          const duration = callData.endTime ? Math.round((new Date(callData.endTime) - new Date(callData.startTime)) / 60000) : 0;
          const message = `📞 *שיחה חדשה - איטום והדברה*\n\n🕐 ${new Date(callData.startTime).toLocaleString('he-IL')}\n📱 מתקשר: ${callData.caller}\n⏱️ משך: ${duration} דקות\n\n👤 לקוח: ${a.customerName || 'לא זוהה'}\n🏠 כתובת: ${a.address || 'לא נמסרה'}\n🐛 בעיה: ${a.problemType || 'לא זוהה'}\n💰 מחיר: ${a.agreedPrice || 'לא סוכם'}\n📅 ביקור: ${a.visitDate || 'לא נקבע'}\n\n📋 ${a.summary || ''}`;
          await twilioClient.messages.create({ from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`, to: `whatsapp:${process.env.OWNER_WHATSAPP}`, body: message });
          console.log('WhatsApp sent');
    } catch (error) { console.error('WhatsApp error:', error.message); }
}

app.get('/api/calls', (req, res) => res.json(callHistory));
app.get('/api/calls/:sid', (req, res) => {
    const call = callHistory.find(c => c.sid === req.params.sid);
    call ? res.json(call) : res.status(404).json({ error: 'Not found' });
});

app.get('/manifest.json', (req, res) => res.sendFile(path.join(__dirname, 'public', 'manifest.json')));
app.get('/sw.js', (req, res) => { res.setHeader('Content-Type', 'application/javascript'); res.sendFile(path.join(__dirname, 'public', 'sw.js')); });

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`CallApp running on port ${PORT}`));mber(process.env.OWNER_WHATSAPP);
    res.type('text/xml');
    res.send(twiml.toString());
});

app.post('/recording-complete', async (req, res) => {
    const callSid = req.body.CallSid;
    const recordingUrl = req.body.RecordingUrl;
    console.log(`Recording complete for ${callSid}`);
    if (activeCalls[callSid]) activeCalls[callSid].recordingUrl = recordingUrl;
    try {
          const recordingResponse = await axios.ge
