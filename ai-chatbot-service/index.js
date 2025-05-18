require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { Eureka } = require('eureka-js-client');

const client = new Eureka({
  instance: {
    app: 'AI-CHATBOT-SERVICE',
    hostName: 'localhost',
    ipAddr: '127.0.0.1',
    port: { '$': 3002, '@enabled': true },
    vipAddress: 'AI-CHATBOT-SERVICE',
    dataCenterInfo: { '@class': 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo', name: 'MyOwn' },
  },
  eureka: {
    host: 'localhost',
    port: 8761,
    servicePath: '/eureka/apps/'
  }
});
client.start();

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ Chưa cấu hình GEMINI_API_KEY trong file .env!');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

app.post('/api/ai-chatbot', async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages)) {
    return res.status(400).json({ reply: 'messages phải là một mảng!' });
  }

  // Chuyển đổi messages sang format Gemini SDK
  const history = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent({ contents: history });
    const reply = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "Xin lỗi, Gemini không trả lời được lúc này.";
    res.json({ reply });
  } catch (error) {
    console.error(error);
    res.json({ reply: 'Xin lỗi, Gemini không trả lời được lúc này.' });
  }
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`AI Chatbot service (Gemini) running on port ${PORT}`);
});