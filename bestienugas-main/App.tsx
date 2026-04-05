import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  FileText,
  Send,
  AlertCircle,
  Heart,
  Search,
  LogIn,
  LogOut,
  MessageSquare,
  Info,
} from 'lucide-react';
import { Button } from './components/Button';
import { ChatMessage } from './components/ChatMessage';
import { Sidebar } from './components/Sidebar';
import { WelcomeModal } from './components/modals/WelcomeModal';
import { LimitReachedModal } from './components/modals/LimitReachedModal';
import { StorageLimitModal } from './components/modals/StorageLimitModal';
import {
  ChatState,
  Message,
  Sender,
  UploadedFile,
  Session,
  FileMetadata,
  ERROR_LIMIT_REACHED,
  ERROR_STORAGE_LIMIT,
} from './types';
import { generateResponseStream } from './services/geminiService';
import {
  createNewSession,
  loadMessagesFromSession,
  deleteSession,
  clearAllHistory,
} from './services/firestoreService';
import { useAuth } from './hooks/useAuth';
import { useSessions } from './hooks/useSessions';

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

      if (!file.data) {
        if (isPageActive) setError('Data PDF kosong atau rusak.');
        return;
      }

      if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }

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
        const loadingTask = window.pdfjsLib.getDocument({ data: atob(file.data) });
        const pdf = await loadingTask.promise;

        if (!isPageActive) return;

        let safePageNumber = pageNumber;
        if (safePageNumber < 1) safePageNumber = 1;
        if (safePageNumber > pdf.numPages) safePageNumber = pdf.numPages;

        const page = await pdf.getPage(safePageNumber);

        if (!isPageActive) return;

        if (!containerRef.current) return;
        const containerWidth = containerRef.current.clientWidth - 48;
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas context not found');

        context.clearRect(0, 0, canvas.width, canvas.height);
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        if (!isPageActive) return;

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;

        if (renderTaskRef.current === renderTask) {
          renderTaskRef.current = null;
        }

        if (!isPageActive) return;

        if (highlightText && highlightText.length > 2) {
          const textContent = await page.getTextContent();
          if (!isPageActive) return;

          const normalizeText = (text: string) => {
            return text
              .replace(/[.,;:!?"'()\[\]{}—–‐‑‒–————]/g, ' ')
              .toLowerCase()
              .replace(/\s+/g, ' ')
              .trim();
          };

          const cleanHighlight = normalizeText(highlightText);
          const highlightWords = cleanHighlight.split(' ').filter((w) => w.length > 2);

          const allItems: { str: string; norm: string; item: any }[] = textContent.items
            .filter((item: any) => item.str && item.str.trim().length > 0)
            .map((item: any) => ({ str: item.str, norm: normalizeText(item.str), item }));

          const fullText = allItems.map((i) => i.norm).join(' ');
          const phraseIndex = fullText.indexOf(cleanHighlight);

          let matchedItems: Set<any> = new Set();

          if (phraseIndex !== -1) {
            let pos = 0;
            for (const entry of allItems) {
              const start = pos;
              const end = pos + entry.norm.length;
              if (end > phraseIndex && start < phraseIndex + cleanHighlight.length) {
                matchedItems.add(entry.item);
              }
              pos = end + 1;
            }
          } else if (highlightWords.length >= 2) {
            for (const entry of allItems) {
              const consecutiveMatch = highlightWords.some((word, i) => {
                if (i === 0) return false;
                return (
                  entry.norm.includes(highlightWords[i - 1]) && entry.norm.includes(word)
                );
              });
              if (consecutiveMatch) {
                matchedItems.add(entry.item);
              }
            }
          }

          context.fillStyle = 'rgba(255, 255, 0, 0.4)';
          context.strokeStyle = 'rgba(255, 200, 0, 0.8)';
          context.lineWidth = 2;

          for (const item of matchedItems) {
            const tx = window.pdfjsLib.Util.transform(viewport.transform, item.transform);
            const itemWidth = item.width * scale;
            const x = tx[4];
            const y = tx[5] - item.height * scale;
            context.fillRect(x, y, itemWidth, item.height * scale * 1.2);
            context.strokeRect(x, y, itemWidth, item.height * scale * 1.2);
          }
        }

        setLoading(false);
      } catch (err: any) {
        if (isPageActive && err.name !== 'RenderingCancelledException') {
          console.error('PDF Render Error:', err);
          setError('Gagal merender halaman PDF.');
          setLoading(false);
        }
      }
    };

    renderPdf();

    return () => {
      isPageActive = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [file, pageNumber, highlightText]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col bg-slate-100 overflow-hidden rounded-xl border border-slate-300 relative"
    >
      <div className="bg-white px-4 py-2 border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="p-1.5 bg-red-50 text-red-600 rounded">
            <FileText size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-slate-700 truncate max-w-[150px]">
              {file.name}
            </h3>
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
    <h3 className="text-lg font-semibold text-slate-800 mb-2">
      Ntar liat di sini kalo trust issue sitasi
    </h3>
  </div>
);

// --- Main App ---

const App: React.FC = () => {
  const { currentUser, userProfile, loading: authLoading, signInWithGoogle, signOut } = useAuth();

  // ── Chat state ──
  const [state, setState] = useState<ChatState>({
    isLoading: false,
    messages: [],
    files: [],
    error: null,
  });

  const [input, setInput] = useState('');

  // ── Session state ──
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [missingFiles, setMissingFiles] = useState<string[]>([]);

  // ── Sidebar state ──
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Viewer state ──
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<number>(1);
  const [activeHighlight, setActiveHighlight] = useState<string>('');

  // ── Modal state ──
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Real-time sessions from Firestore ──
  const { sessions, loading: sessionsLoading } = useSessions(currentUser?.uid ?? null);

  // Show welcome modal once per session
  useEffect(() => {
    const welcomed = sessionStorage.getItem('bestie_welcomed');
    if (!welcomed) {
      setShowWelcomeModal(true);
      sessionStorage.setItem('bestie_welcomed', '1');
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [state.messages]);

  // ── Reset chat when user logs out ──
  useEffect(() => {
    if (!currentUser) {
      setCurrentSessionId(null);
      setMissingFiles([]);
      setState({ isLoading: false, messages: [], files: [], error: null });
    }
  }, [currentUser]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleCitationClick = (filename: string, page: number, text: string) => {
    const cleanAiName = filename.toLowerCase().replace(/[^a-z0-9]/g, '');

    let foundFile = state.files.find((f) => {
      const cleanRealName = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanRealName.includes(cleanAiName) || cleanAiName.includes(cleanRealName);
    });

    const targetFile =
      foundFile || state.files.find((f) => f.id === activeFileId) || state.files[0];

    if (targetFile) {
      setActiveFileId(targetFile.id);
      setActivePage(page);
      setActiveHighlight('');
      setTimeout(() => setActiveHighlight(text), 10);
    }
  };

  /** Reset to a blank new chat — does NOT create a Firestore session yet */
  const handleNewChat = useCallback(() => {
    setCurrentSessionId(null);
    setMissingFiles([]);
    setState({ isLoading: false, messages: [], files: [], error: null });
    setActiveFileId(null);
    setActivePage(1);
    setActiveHighlight('');
    setInput('');
  }, []);

  /** Load a session from Firestore and check for missing PDF files */
  const handleSelectSession = useCallback(
    async (session: Session) => {
      if (!currentUser) return;

      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      setCurrentSessionId(session.id);
      setMissingFiles([]);

      try {
        const sessionMessages = await loadMessagesFromSession(currentUser.uid, session.id);

        // Convert SessionMessage[] → Message[] for the UI
        const uiMessages: Message[] = sessionMessages.map((sm) => ({
          id: sm.id,
          text: sm.text,
          sender: sm.role === 'user' ? Sender.USER : Sender.AI,
          timestamp: sm.timestamp,
          isStreaming: false,
        }));

        setState((prev) => ({
          ...prev,
          isLoading: false,
          messages: uiMessages,
          // Keep existing files in state — don't wipe them
        }));

        // Check which files from the session are missing from current state
        const currentFileNames = state.files.map((f) => f.name.toLowerCase());
        const missing = session.files
          .filter((fm) => !currentFileNames.includes(fm.name.toLowerCase()))
          .map((fm) => fm.name);

        setMissingFiles(missing);
      } catch (err) {
        console.error('Failed to load session:', err);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Gagal memuat riwayat chat.',
        }));
      }
    },
    [currentUser, state.files]
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      if (!currentUser) return;
      try {
        await deleteSession(currentUser.uid, sessionId);
        // If we deleted the active session, reset to new chat
        if (sessionId === currentSessionId) {
          handleNewChat();
        }
      } catch (err) {
        console.error('Failed to delete session:', err);
      }
    },
    [currentUser, currentSessionId, handleNewChat]
  );

  const handleClearAll = useCallback(async () => {
    if (!currentUser) return;
    if (!window.confirm('Hapus semua riwayat chat? Tindakan ini tidak bisa dibatalkan.')) return;
    try {
      await clearAllHistory(currentUser.uid);
      handleNewChat();
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  }, [currentUser, handleNewChat]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const newFilesList = event.target.files;
    if (!newFilesList || newFilesList.length === 0) return;

    if (state.files.length + newFilesList.length > MAX_FILES) {
      setState((prev) => ({
        ...prev,
        error: `Waduh Bestie, maksimal ${MAX_FILES} file dulu ya!`,
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

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
            mimeType: file.type,
          });
        };
        reader.readAsDataURL(file);
      });
    });

    try {
      const loadedFiles = (await Promise.all(filePromises)).filter(
        (f): f is UploadedFile => f !== null
      );

      setState((prev) => {
        const newFileList = [...prev.files, ...loadedFiles];
        if (!activeFileId && loadedFiles.length > 0) {
          setActiveFileId(loadedFiles[0].id);
        }

        const initialMessage =
          prev.files.length === 0
            ? [
                {
                  id: 'system-welcome',
                  text: `**Analisis Siap!** Aku udah baca file kamu.\n\nTanya apa aja, insyaallah aku jawab sesuai sitasi`,
                  sender: Sender.AI,
                  timestamp: Date.now(),
                },
              ]
            : [...prev.messages];

        return {
          ...prev,
          files: newFileList,
          isLoading: false,
          messages: initialMessage,
          error: null,
        };
      });

      // When new files are uploaded, clear the missing-file hint for those files
      setMissingFiles((prev) =>
        prev.filter(
          (name) => !loadedFiles.some((f) => f.name.toLowerCase() === name.toLowerCase())
        )
      );
    } catch (err) {
      setState((prev) => ({ ...prev, isLoading: false, error: 'Gagal baca file.' }));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || state.files.length === 0 || state.isLoading) return;

    // Block if not logged in
    if (!currentUser) {
      setState((prev) => ({ ...prev, error: 'Login dulu ya Bestie biar bisa nanya! 💙' }));
      return;
    }

    // Block if chats_left is 0
    if (userProfile && userProfile.chats_left <= 0) {
      setShowLimitModal(true);
      return;
    }

    // ── Auto-create session on first message ──
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      try {
        const filesMeta: FileMetadata[] = state.files.map((f) => ({ id: f.id, name: f.name }));
        const sessionTitle = input.trim().substring(0, 60) + (input.trim().length > 60 ? '…' : '');
        activeSessionId = await createNewSession(currentUser.uid, sessionTitle, filesMeta);
        setCurrentSessionId(activeSessionId);
      } catch (err) {
        console.error('Failed to create session:', err);
        // Continue without session — messages won't be saved but chat still works
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: Sender.USER,
      timestamp: Date.now(),
    };
    const aiMessageId = (Date.now() + 1).toString();
    const initialAiMessage: Message = {
      id: aiMessageId,
      text: '',
      sender: Sender.AI,
      timestamp: Date.now(),
      isStreaming: true,
    };

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage, initialAiMessage],
      isLoading: true,
    }));
    setInput('');

    try {
      let accumulatedText = '';
      await generateResponseStream(
        state.messages,
        userMessage.text,
        state.files,
        (chunk) => {
          accumulatedText += chunk;
          setState((prev) => ({
            ...prev,
            messages: prev.messages.map((msg) =>
              msg.id === aiMessageId ? { ...msg, text: accumulatedText } : msg
            ),
          }));
        },
        currentUser.uid,
        activeSessionId ?? undefined
      );
      setState((prev) => ({
        ...prev,
        isLoading: false,
        messages: prev.messages.map((msg) =>
          msg.id === aiMessageId ? { ...msg, isStreaming: false } : msg
        ),
      }));
    } catch (err: any) {
      if (err.code === ERROR_LIMIT_REACHED) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          messages: prev.messages.filter((msg) => msg.id !== aiMessageId),
        }));
        setShowLimitModal(true);
      } else if (err.code === ERROR_STORAGE_LIMIT) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          messages: prev.messages.map((msg) =>
            msg.id === aiMessageId ? { ...msg, isStreaming: false } : msg
          ),
        }));
        setShowStorageModal(true);
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err.message || 'Gagal generate jawaban.',
          messages: prev.messages.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, isStreaming: false, text: msg.text || '⚠️ Gagal mendapatkan jawaban.' }
              : msg
          ),
        }));
      }
    }
  };

  // Get Active File Object
  const activeFile = state.files.find((f) => f.id === activeFileId);

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">

      {/* Modals */}
      <WelcomeModal isOpen={showWelcomeModal} onClose={() => setShowWelcomeModal(false)} />
      <LimitReachedModal isOpen={showLimitModal} onClose={() => setShowLimitModal(false)} />
      <StorageLimitModal isOpen={showStorageModal} onClose={() => setShowStorageModal(false)} />

      {/* Header Bar */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-2">
          <Heart className="text-brand-600 fill-brand-100" />
          <h1 className="font-bold text-slate-800 text-lg">Bestie Nugas</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Files count badge */}
          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {state.files.length} File dibaca
          </span>

          {/* Auth section */}
          {authLoading ? (
            <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse" />
          ) : currentUser ? (
            <div className="flex items-center gap-2">
              {/* chats_left badge */}
              {userProfile !== null && (
                <div
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    userProfile.chats_left > 2
                      ? 'bg-pastel-mint-100 text-green-700 border-pastel-mint-200'
                      : userProfile.chats_left > 0
                      ? 'bg-pastel-yellow-100 text-amber-700 border-pastel-yellow-200'
                      : 'bg-pastel-pink-100 text-red-600 border-pastel-pink-200'
                  }`}
                >
                  <MessageSquare size={11} />
                  <span>{userProfile.chats_left} chat tersisa</span>
                </div>
              )}

              {/* User avatar */}
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName ?? 'User'}
                  className="w-8 h-8 rounded-full border-2 border-pastel-blue-200 shadow-sm"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-pastel-blue-100 border-2 border-pastel-blue-200 flex items-center justify-center text-xs font-bold text-blue-600">
                  {(currentUser.displayName ?? currentUser.email ?? 'B')[0].toUpperCase()}
                </div>
              )}

              {/* Sign out button */}
              <button
                onClick={signOut}
                title="Sign out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white text-xs font-semibold shadow-cute transition-all duration-200 hover:-translate-y-0.5"
            >
              <LogIn size={13} />
              Login dengan Google
            </button>
          )}

          <Button
            variant="secondary"
            className="!py-1.5 !text-xs !px-3"
            onClick={handleNewChat}
          >
            Reset
          </Button>

<button
  onClick={() => {
    if (!currentUser) {
      alert("Login dulu di Bestie Nugas ya, biar bisa akses Kuy Jurnal! 💛");
      return;
    }

    // Kita tambahkan &t=${Date.now()} supaya link-nya unik terus tiap diklik
    const streamlitUrl = `https://kuy-jurnal-bestie-nugas.streamlit.app?auth=bestie_nugas_oke&user=${encodeURIComponent(currentUser.email || '')}&t=${Date.now()}`;
    
    window.open(streamlitUrl, '_blank');
  }}
  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200 shadow-sm transition-all duration-200 hover:-translate-y-0.5"
>
  <span>💛 Kuy Jurnal</span>
</button>

        </div>
      </header>

      {/* Main layout: Sidebar + Chat + PDF Viewer */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Sidebar ── */}
        <Sidebar
          sessions={sessions}
          activeSessionId={currentSessionId}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen((v) => !v)}
          onNewChat={handleNewChat}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onClearAll={handleClearAll}
          isLoggedIn={!!currentUser}
          sessionsLoading={sessionsLoading}
        />

        {/* ── LEFT: Chat Area ── */}
        <div className="flex-1 md:flex-[0.4] flex flex-col border-r border-slate-200 bg-white min-w-[280px]">

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
              state.messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} onCitationClick={handleCitationClick} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Missing-file hint banner */}
          {missingFiles.length > 0 && (
            <div className="mx-4 mb-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-700">
              <Info size={14} className="shrink-0 mt-0.5 text-amber-500" />
              <div className="flex-1">
                <p className="font-semibold mb-0.5">Duh perlu PDF PDF lagi nih buat klik sitasi:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {missingFiles.map((name) => (
                    <li key={name}>
                      Re-upload <span className="font-medium">"{name}"</span> dulu ya Best!
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1.5 underline text-amber-600 hover:text-amber-800"
                >
                  Upload sekarang →
                </button>
              </div>
              <button
                onClick={() => setMissingFiles([])}
                className="text-amber-400 hover:text-amber-600 shrink-0"
              >
                ✕
              </button>
            </div>
          )}

          {/* Error banner */}
          {state.error && (
            <div className="mx-4 mb-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-600">
              <AlertCircle size={14} className="shrink-0" />
              <span>{state.error}</span>
              <button
                onClick={() => setState((prev) => ({ ...prev, error: null }))}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-slate-100 bg-white">
            {state.files.length > 0 && (
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                {state.files.map((f) => (
                  <div
                    key={f.id}
                    onClick={() => {
                      setActiveFileId(f.id);
                      setActivePage(1);
                    }}
                    className={`shrink-0 text-xs px-2 py-1 rounded border cursor-pointer flex items-center gap-1 ${
                      activeFileId === f.id
                        ? 'bg-brand-50 border-brand-200 text-brand-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <FileText size={10} /> {f.name.substring(0, 15)}...
                  </div>
                ))}
                {state.files.length < MAX_FILES && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="shrink-0 text-xs px-2 py-1 rounded border border-dashed border-slate-300 text-slate-400 hover:text-brand-500 hover:border-brand-300"
                  >
                    + Tambah
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleSendMessage} className="relative">
              <input
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-brand-100 focus:border-brand-400 outline-none transition-all"
                placeholder={
                  !currentUser
                    ? 'Login dulu ya Bestie 💙'
                    : state.files.length === 0
                    ? 'Masukin PDF dulu Bestie'
                    : userProfile && userProfile.chats_left <= 0
                    ? 'Limit habis, chat developer cantik buat nambah🥺'
                    : 'Tanya tentang isi jurnal...'
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={
                  state.files.length === 0 ||
                  !currentUser ||
                  (userProfile !== null && userProfile.chats_left <= 0)
                }
              />
              <button
                type="submit"
                disabled={
                  !input ||
                  state.isLoading ||
                  !currentUser ||
                  (userProfile !== null && userProfile.chats_left <= 0)
                }
                className="absolute right-2 top-2 p-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {state.isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </form>
            <p className="text-[10px] text-center text-slate-300 mt-2">
              Izin... AI bisa salah, cek lagi ye
            </p>
          </div>
        </div>

        {/* ── RIGHT: PDF Evidence Viewer ── */}
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

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="application/pdf"
        multiple
        className="hidden"
      />
    </div>
  );
};

export default App;

