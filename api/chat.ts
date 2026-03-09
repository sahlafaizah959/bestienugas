import { GoogleGenAI, GenerateContentResponse, Content } from '@google/genai';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { MODEL_NAME, SYSTEM_INSTRUCTION } from './constants';
import { Message, UploadedFile } from './types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { history, currentPrompt, files } = req.body;

    // Validasi API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API_KEY tidak dikonfigurasi' });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Logic Mapping History
    const formattedHistory: Content[] = history.map((msg: any) => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    // Logic File & Chat
    const contentParts = [
      ...files.map((file: any) => ({
        inlineData: { mimeType: file.mimeType, data: file.data }
      })),
      { text: currentPrompt }
    ];

    const chat = ai.chats.create({
      model: MODEL_NAME,
      history: formattedHistory,
      config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.3 }
    });

    const resultStream = await chat.sendMessageStream({
  message: contentParts
});

    // Stream ke Res
    for await (const chunk of resultStream) {
      if (chunk.text) {
        res.write(chunk.text);
      }
    }
    res.end();

  } catch (error: any) {
    console.error('Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  }
}