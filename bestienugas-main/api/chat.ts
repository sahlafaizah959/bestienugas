import { GoogleGenAI, type Content, type GenerateContentResponse } from '@google/genai';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { MODEL_NAME, SYSTEM_INSTRUCTION } from '../constants.js';

// Type definitions for request body
interface FileData {
  name: string;
  mimeType: string;
  data: string;
}

interface Message {
  sender: 'user' | 'model';
  text: string;
}

interface ChatRequestBody {
  history: Message[];
  currentPrompt: string;
  files: FileData[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const { history, currentPrompt, files } = req.body as ChatRequestBody;

    // Validate required fields
    if (!history || !currentPrompt || !Array.isArray(files)) {
      return res.status(400).json({ error: 'Missing required fields in request body' });
    }

    // Support both API_KEY and GEMINI_API_KEY env var names
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API_KEY tidak dikonfigurasi di Vercel Environment Variables' });
    }

    // Initialize AI client using @google/genai SDK
    const ai = new GoogleGenAI({ apiKey });

    // Logic Mapping History
    const formattedHistory: Content[] = history.map((msg: any) => {
      if (typeof msg.text !== 'string') {
        throw new Error('Invalid message format: text must be a string');
      }
      return {
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      };
    });

    // Inject real filenames so AI never guesses
    const fileContextPreamble = files.length > 0
      ? `[MANDATORY FILE CONTEXT — FOR CITATIONS]\n` +
        `The following files have been uploaded. You MUST use these EXACT filenames in all citation links.\n` +
        `Do NOT rename, guess, or derive filenames from document content.\n\n` +
        files.map((file: any, i: number) => {
          if (typeof file.name !== 'string' || typeof file.mimeType !== 'string') {
            throw new Error('Invalid file format: name and mimeType must be strings');
          }
          return `File ${i + 1}: "${file.name}" (MIME: ${file.mimeType})`;
        }).join('\n') +
        `\n[END OF FILE CONTEXT]\n\n`
      : '';

    const contentParts = [
      // Preamble injected FIRST before PDF data
      ...(fileContextPreamble ? [{ text: fileContextPreamble }] : []),
      ...files.map((file: any) => {
        if (typeof file.data !== 'string') {
          throw new Error('Invalid file format: data must be a string');
        }
        return {
          inlineData: { mimeType: file.mimeType, data: file.data }
        };
      }),
      { text: currentPrompt }
    ];

    // Set streaming headers BEFORE writing any data
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
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.3,
          }
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

    // Stream response
    try {
      for await (const chunk of resultStream) {
        const responseChunk = chunk as GenerateContentResponse;
        if (responseChunk.text) {
          res.write(responseChunk.text);
        }
      }
    } catch (streamError: any) {
      console.error('Error during streaming:', streamError);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error during streaming response' });
      }
    } finally {
      res.end();
    }

  } catch (error: any) {
    console.error('Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    } else {
      res.end();
    }
  }
}
