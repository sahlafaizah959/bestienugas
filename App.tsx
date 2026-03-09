import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, Send, AlertCircle, Heart, Plus, X, Search, ChevronLeft, ChevronRight, BookOpen, Sparkles } from 'lucide-react';
import { Button } from './components/Button';
import { ChatMessage } from './components/ChatMessage';
import { ChatState, Message, Sender, UploadedFile } from './types';
import { generateResponseStream } from './services/geminiService';

const MAX_FILES = 3;

// --- PDF.js Type Definitions (Since we use CDN) ---
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

// --- Lightweight Canvas PDF Viewer ---
interface PdfViewerProps {
  file: UploadedFile;
  pageNumber: number;
  highlightText?: string;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ file, pageNumber, highlightText }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    let isPageActive = true;

    const renderPdf = async () => {
      if (!canvasRef.current || !containerRef.current || !window.pdfjsLib) return;

      // 1. VALIDATION: Check if file data exists
      if (!file.data) {
        if (isPageActive) setError("Data PDF kosong atau rusak.");
        return;
      }

      // 2. CONFIG: Ensure Worker is set
      if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }

      // 3. CLEANUP: Cancel previous render task if it exists
      if (renderTaskRef.current) {
        try {
          await renderTaskRef.current.cancel();
        } catch (e) {
          // Ignore cancel errors
        }
        renderTaskRef.current = null;
      }

      if (!isPageActive) return;

      setLoading(true);
      setError(null);

      try {
        // Load Document
        const loadingTask = window.pdfjsLib.getDocument({ data: atob(file.data) });
        const pdf = await loadingTask.promise;

        if (!isPageActive) return;

        // FIX: Validate page number
        let safePageNumber = pageNumber;
        if (safePageNumber < 1) safePageNumber = 1;
        if (safePageNumber > pdf.numPages) safePageNumber = pdf.numPages;

        // Load Page
        const page = await pdf.getPage(safePageNumber);

        if (!isPageActive) return;

        // Calculate Scale
        if (!containerRef.current) return;
        const containerWidth = containerRef.current.clientWidth - 48; // padding
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale });

        // Setup Canvas
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) throw new Error("Canvas context not found");

        // Clear canvas before new render
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render Page content
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        
        // Check one last time before starting the render task
        if (!isPageActive) return;

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        
        await renderTask.promise;
        
        // Task finished, clear ref
        if (renderTaskRef.current === renderTask) {
            renderTaskRef.current = null;
        }

        if (!isPageActive) return;

        // --- HIGHLIGHTING LOGIC ---
        if (highlightText && highlightText.length > 2) {
          const textContent = await page.getTextContent();
          if (!isPageActive) return;

          const normalizeText = (text: string) => {
            return text
              .replace(/[^\w\s]/gi, '')
              .toLowerCase()
              .replace(/\s+/g, ' ')
              .trim();
          };

          const cleanHighlight = normalizeText(highlightText);
          
          context.fillStyle = 'rgba(255, 255, 0, 0.4)'; // Transparent Yellow
          context.strokeStyle = 'rgba(255, 200, 0, 0.8)';
          context.lineWidth = 2;

          textContent.items.forEach((item: any) => {
            const itemStr = normalizeText(item.str);
            if (itemStr && cleanHighlight && (itemStr.includes(cleanHighlight) || cleanHighlight.includes(itemStr))) {
              const tx = window.pdfjsLib.Util.transform(
                viewport.transform,
                item.transform
              );
              
              const itemWidth = item.width * scale;
              
              const x = tx[4];
              const y = tx[5] - (item.height * scale); // Adjust for baseline
              
              context.fillRect(x, y, itemWidth, item.height * scale * 1.2);
              context.strokeRect(x, y, itemWidth, item.height * scale * 1.2);
            }
          });
        }

        setLoading(false);
      } catch (err: any) {
        if (isPageActive && err.name !== 'RenderingCancelledException') {
          console.error("PDF Render Error:", err);
          setError("Gagal merender halaman PDF.");
          setLoading(false);
        }
      }
    };

    renderPdf();

    // Cleanup function
    return () => {
      isPageActive = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [file, pageNumber, highlightText]);

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col bg-slate-100 overflow-hidden rounded-xl border border-slate-300 relative">
      {/* Viewer Header */}
      <div className="bg-white px-4 py-2 border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="p-1.5 bg-red-50 text-red-600 rounded">
            <FileText size={16} />
          </div>
          <div className="min-w-0">
             <h3 className="text-xs font-bold text-slate-700 truncate max-w-[150px]">{file.name}</h3>
             <p className="text-[10px] text-slate-500">Halaman {pageNumber}</p>
          </div>
        </div>
        {highlightText && (
          <div className="flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-[10px] border border-yellow-200">
            <Search size={10} />
            <span className="truncate max-w-[100px]">"{highlightText}"</span>
          </div>
        )}
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-auto p-4 flex justify-center bg-slate-200/50">
        <div className="relative shadow-xl bg-white transition-all duration-300 ease-in-out">
          {loading && (
             <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-sm">
               <div className="flex flex-col items-center animate-pulse">
                  <div className="h-8 w-8 bg-brand-200 rounded-full mb-2"></div>
                  <div className="h-2 w-24 bg-slate-200 rounded"></div>
               </div>
             </div>
          )}
          {error && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white">
              <div className="text-center text-red-500">
                <AlertCircle className="mx-auto mb-2" />
                <p className="text-xs">{error}</p>
              </div>
            </div>
          )}
          <canvas ref={canvasRef} className="block bg-white" />
        </div>
      </div>
    </div>
  );
};


// --- Placeholder Component ---
const ViewerPlaceholder = () => (
  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 border-dashed rounded-xl p-8 text-center">
    <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mb-6 shadow-sm">
      <Heart size={32} className="text-brand-600 fill-brand-100" />
    </div>
    <h3 className="text-lg font-semibold text-slate-800 mb-2">Ntar liat di sini kalo trust issue sitasi</h3>
  </div>
);

// --- Main App ---

const App: React.FC = () => {
  const [state, setState] = useState<ChatState>({
    isLoading: false,
    messages: [],
    files: [],
    error: null,
  });
  
  const [input, setInput] = useState('');
  
  // Viewer State
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<number>(1);
  const [activeHighlight, setActiveHighlight] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages]);

  // --- Handlers ---

  const handleCitationClick = (filename: string, page: number, text: string) => {
  // 1. Bersihkan nama dari AI
  const cleanAiName = filename.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 2. Cari file yang paling mirip
  let foundFile = state.files.find(f => {
    const cleanRealName = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanRealName.includes(cleanAiName) || cleanAiName.includes(cleanRealName);
  });

  // 3. JIKA MASIH GAK KETEMU: Pakai file yang saat ini sedang dibuka user (Active File)
  // Ini trik paling ampuh kalau cuma ada 1-2 file
  const targetFile = foundFile || state.files.find(f => f.id === activeFileId) || state.files[0];

  if (targetFile) {
    setActiveFileId(targetFile.id);
    setActivePage(page);
    // Kita tambahkan sedikit delay atau paksa update highlight
    setActiveHighlight(""); 
    setTimeout(() => setActiveHighlight(text), 10);
  }
};

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFilesList = event.target.files;
    if (!newFilesList || newFilesList.length === 0) return;

    if (state.files.length + newFilesList.length > MAX_FILES) {
      setState(prev => ({ ...prev, error: `Waduh Bestie, maksimal ${MAX_FILES} file dulu ya!` }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    // Explicitly cast file to File to fix 'unknown' type errors
    const filePromises = Array.from(newFilesList).map((file: File) => {
      return new Promise<UploadedFile | null>((resolve) => {
        if (file.type !== 'application/pdf' || file.size > 40 * 1024 * 1024) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64String = (e.target?.result as string).split(',')[1];
          resolve({
            id: Math.random().toString(36).substring(7),
            name: file.name,
            type: file.type,
            size: file.size,
            data: base64String,
            mimeType: file.type
          });
        };
        reader.readAsDataURL(file);
      });
    });

    try {
      const loadedFiles = (await Promise.all(filePromises)).filter((f): f is UploadedFile => f !== null);
      
      setState(prev => {
        const newFileList = [...prev.files, ...loadedFiles];
        // Auto select first file if viewer is empty
        if (!activeFileId && loadedFiles.length > 0) {
           setActiveFileId(loadedFiles[0].id);
        }

        const initialMessage = prev.files.length === 0 ? [{
            id: 'system-welcome',
            text: `**Analisis Siap!** Aku udah baca file kamu.\n\nTanya apa aja, insyaallah aku jawab sesuai sitasi`,
            sender: Sender.AI,
            timestamp: Date.now()
          }] : [...prev.messages];

        return { ...prev, files: newFileList, isLoading: false, messages: initialMessage, error: null };
      });
    } catch (err) {
      setState(prev => ({ ...prev, isLoading: false, error: 'Gagal baca file.' }));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || state.files.length === 0 || state.isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), text: input, sender: Sender.USER, timestamp: Date.now() };
    const aiMessageId = (Date.now() + 1).toString();
    const initialAiMessage: Message = { id: aiMessageId, text: '', sender: Sender.AI, timestamp: Date.now(), isStreaming: true };

    setState(prev => ({ ...prev, messages: [...prev.messages, userMessage, initialAiMessage], isLoading: true }));
    setInput('');

    try {
      let accumulatedText = '';
      await generateResponseStream(state.messages, userMessage.text, state.files, (chunk) => {
        accumulatedText += chunk;
        setState(prev => ({
          ...prev,
          messages: prev.messages.map(msg => msg.id === aiMessageId ? { ...msg, text: accumulatedText } : msg)
        }));
      });
      setState(prev => ({ ...prev, isLoading: false, messages: prev.messages.map(msg => msg.id === aiMessageId ? { ...msg, isStreaming: false } : msg) }));
    } catch (err) {
      setState(prev => ({ ...prev, isLoading: false, error: 'Gagal generate jawaban.' }));
    }
  };

  // Get Active File Object
  const activeFile = state.files.find(f => f.id === activeFileId);

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
      
      {/* Header Bar */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-2">
          <Heart className="text-brand-600 fill-brand-100" />
          <h1 className="font-bold text-slate-800 text-lg">Bestie Nugas</h1>
        </div>
        <div className="flex items-center gap-3">
           <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
             {state.files.length} File dibaca
           </span>
           <Button variant="secondary" className="!py-1.5 !text-xs !px-3" onClick={() => setState({ isLoading: false, messages: [], files: [], error: null })}>
             Reset
           </Button>
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT: Chat Area (40% width on Desktop) */}
        <div className="flex-1 md:flex-[0.4] flex flex-col border-r border-slate-200 bg-white min-w-[320px]">
          
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {state.messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                 <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center rotate-3">
                    <UploadCloud className="text-brand-500" size={32} />
                 </div>
                 <div>
                   <h2 className="font-bold text-slate-700">Upload PDF Only yaw</h2>
                   <p className="text-sm text-slate-400 mt-1">Jurnal satu kolom, Maks 3 file (40MB)</p>
                 </div>
                 <Button onClick={() => fileInputRef.current?.click()} className="mt-4">
                   Pilih File PDF
                 </Button>
              </div>
            ) : (
              state.messages.map(msg => (
                <ChatMessage key={msg.id} message={msg} onCitationClick={handleCitationClick} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-100 bg-white">
             {state.files.length > 0 && (
               <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                 {state.files.map(f => (
                   <div key={f.id} onClick={() => { setActiveFileId(f.id); setActivePage(1); }} className={`shrink-0 text-xs px-2 py-1 rounded border cursor-pointer flex items-center gap-1 ${activeFileId === f.id ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                      <FileText size={10} /> {f.name.substring(0, 15)}...
                   </div>
                 ))}
                 {state.files.length < MAX_FILES && (
                    <button onClick={() => fileInputRef.current?.click()} className="shrink-0 text-xs px-2 py-1 rounded border border-dashed border-slate-300 text-slate-400 hover:text-brand-500 hover:border-brand-300">
                      + Tambah
                    </button>
                 )}
               </div>
             )}
             
             <form onSubmit={handleSendMessage} className="relative">
               <input 
                 className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-brand-100 focus:border-brand-400 outline-none transition-all"
                 placeholder={state.files.length === 0 ? "Masukin PDF dulu Bestie" : "Tanya tentang isi jurnal..."}
                 value={input}
                 onChange={e => setInput(e.target.value)}
                 disabled={state.files.length === 0}
               />
               <button type="submit" disabled={!input || state.isLoading} className="absolute right-2 top-2 p-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors">
                 {state.isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Send size={16} />}
               </button>
             </form>
             <p className="text-[10px] text-center text-slate-300 mt-2">Izin... AI bisa salah, cek lagi ye</p>
          </div>
        </div>

        {/* RIGHT: PDF Evidence Viewer (60% width on Desktop) */}
        <div className="hidden md:flex md:flex-[0.6] bg-slate-100 p-4 flex-col">
           {activeFile ? (
             <PdfViewer
               key={`${activeFile.id}-${activePage}-${activeHighlight}`}
               file={activeFile}
              pageNumber={activePage}
              highlightText={activeHighlight}
              />
           ) : (
             <ViewerPlaceholder />
           )}
        </div>

      </div>

      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" multiple className="hidden" />
    </div>
  );
};

export default App;