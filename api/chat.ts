import { GoogleGenAI, Content } from '@google/genai';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { MODEL_NAME, SYSTEM_INSTRUCTION } from '../constants.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { history, currentPrompt, files } = req.body;

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

    // ✅ FIX: Inject real filenames so AI never guesses
    const fileContextPreamble = files.length > 0
      ? `[MANDATORY FILE CONTEXT — FOR CITATIONS]\n` +
        `The following files have been uploaded. You MUST use these EXACT filenames in all citation links.\n` +
        `Do NOT rename, guess, or derive filenames from document content.\n\n` +
        files.map((file: any, i: number) =>
          `File ${i + 1}: "${file.name}" (MIME: ${file.mimeType})`
        ).join('\n') +
        `\n[END OF FILE CONTEXT]\n\n`
      : '';

    const contentParts = [
      // ✅ Preamble injected FIRST before PDF data
      ...(fileContextPreamble ? [{ text: fileContextPreamble }] : []),
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