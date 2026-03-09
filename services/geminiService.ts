import { Message, UploadedFile } from '../types';

export const generateResponseStream = async (
  history: Message[],
  currentPrompt: string,
  files: UploadedFile[],
  onChunk: (text: string) => void
): Promise<void> => {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        history,
        currentPrompt,
        files
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Server error: ${response.status}`;
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error) {
            // Check for nested error structure from Google
            const innerError = typeof errorJson.error === 'string' ? errorJson.error : JSON.stringify(errorJson.error);
            if (innerError.includes('429') || innerError.includes('Quota exceeded')) {
                errorMessage = "Waduh, server lagi rame banget Bestie (Rate Limit). Coba tunggu 10-20 detik terus kirim lagi ya!";
            } else {
                errorMessage = innerError;
            }
        }
      } catch (e) {
        errorMessage = errorText;
      }
      
      throw new Error(errorMessage);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      
      // Mengubah byte menjadi teks secara real-time
      const chunk = decoder.decode(value, { stream: !done });
      
      if (chunk) {
        onChunk(chunk);
      }

      if (done) break;
    }

  } catch (error) {
    console.error("Error generating response:", error);
    throw error;
  }
};