
import 'dotenv/config';
import express from 'express';
import { GoogleGenAI, GenerateContentResponse, Content } from '@google/genai';

// Debug: Log API key status
console.log('API_KEY:', process.env.API_KEY ? 'set' : 'not set');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'set' : 'not set');
import { MODEL_NAME, SYSTEM_INSTRUCTION } from './constants';
import { Message, UploadedFile } from './types';

const app = express();

// Increase payload limit for file uploads (PDFs)
app.use(express.json({ limit: '50mb' }));

// API Routes
app.post('/api/chat', async (req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  try {
    const { history, currentPrompt, files } = req.body as {
      history: Message[];
      currentPrompt: string;
      files: UploadedFile[];
    };

    // 1. Validasi ukuran file (Maks 20MB)
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return res.status(400).json({ 
          error: `Waduh Bestie, file "${file.name}" kegedean nih (lebih dari 20MB). Coba kompres dulu ya!` 
        });
      }
    }

    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API_KEY or GEMINI_API_KEY not configured on server' });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Map history to Gemini Content format
    const formattedHistory: Content[] = history.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    // Reconstruct file context logic from original service
    const fileContext = files.length > 0 
      ? `\n\n[SYSTEM CONTEXT: The user has uploaded ${files.length} files. REFER TO THEM EXACTLY BY THESE NAMES IN CITATIONS:\n${files.map(f => `- ${f.name}`).join('\n')}]`
      : '';

    const contentParts = [
      ...files.map(file => ({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data
        }
      })),
      {
        text: currentPrompt + fileContext
      }
    ];

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Optimasi Response: setNoDelay agar data langsung dikirim tanpa buffering Nagle's algorithm
    res.socket?.setNoDelay(true);

    // Retry Logic & Fallback Mechanism
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
        
        // Berhasil, keluar dari loop
        break;
      } catch (err: any) {
        attempt++;
        console.error(`Attempt ${attempt} failed with model ${currentModel}:`, err);
        
        if (attempt < maxAttempts) {
          // Fallback ke gemini-2.5-flash (karena gemini-1.5-flash sudah deprecated)
          currentModel = 'gemini-2.5-flash';
          console.log(`Retrying with fallback model: ${currentModel}`);
        } else {
          throw err; // Lempar error jika semua percobaan gagal
        }
      }
    }

    for await (const chunk of resultStream) {
      const responseChunk = chunk as GenerateContentResponse;
      if (responseChunk.text) {
        res.write(responseChunk.text);
        // Flush efisien jika ada middleware kompresi
        if (typeof (res as any).flush === 'function') {
          (res as any).flush();
        }
      }
    }

    res.end();

  } catch (error: any) {
    console.error('Error in /api/chat:', error);
    // If headers are already sent, we can't send JSON error
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Internal Server Error' });
    } else {
      res.end(); // End stream if error occurs mid-stream
    }
  }
});


if (process.env.NODE_ENV !== 'production') {
  // Sembunyikan import vite dari static analyzer Vercel agar tidak ikut di-bundle
  const viteModule = 'vite';
  import(viteModule).then(async ({ createServer: createViteServer }) => {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    
    const PORT = parseInt(process.env.PORT || '3000', 10);
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }).catch(err => console.error('Failed to load vite', err));
} else {
  app.use(express.static('dist'));

  import('path').then(path => {
    app.get('*', (req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  });
}

// Export app sebagai default agar Vercel bisa menggunakannya sebagai Serverless Function
export default app;