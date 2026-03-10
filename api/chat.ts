import { GoogleGenAI, Content } from '@google/genai';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { MODEL_NAME, SYSTEM_INSTRUCTION } from '../constants.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { history, currentPrompt, files } = req.body;

    // Support both API_KEY and GEMINI_API_KEY env var names
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API_KEY tidak dikonfigurasi di Vercel Environment Variables' });
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

    // ✅ FIX: Set streaming headers BEFORE writing any data
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200);

    // Retry logic with fallback model
    let attempt = 0;
    const maxAttempts = 2;
    let resultStream: any = null;
    let currentModel = MODEL_NAME;

    while (attempt < maxAttempts) {
      try {
        const chat = ai.chats.create({
          model: currentModel,
          history: formattedHistory,
          config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.3 }
        });

        resultStream = await chat.sendMessageStream({
          message: contentParts
        });

        break; // success
      } catch (err: any) {
        attempt++;
        console.error(`Attempt ${attempt} failed with model ${currentModel}:`, err);
        if (attempt < maxAttempts) {
          currentModel = 'gemini-2.5-flash';
          console.log(`Retrying with fallback model: ${currentModel}`);
        } else {
          throw err;
        }
      }
    }

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
    } else {
      res.end();
    }
  }
}