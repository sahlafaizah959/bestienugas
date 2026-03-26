import React from 'react';
import { X, ExternalLink } from 'lucide-react';

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LimitReachedModal: React.FC<LimitReachedModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-purple-900/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white rounded-4xl shadow-cute-lg border border-pastel-purple-200 overflow-hidden animate-slide-up">
        
        {/* Top gradient strip */}
        <div className="h-2 w-full bg-gradient-to-r from-pastel-purple-300 via-pastel-pink-300 to-pastel-blue-300" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          aria-label="Tutup"
        >
          <X size={16} />
        </button>

        {/* Content */}
        <div className="px-8 pt-8 pb-8 text-center">
          {/* Emoji icon */}
          <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-gradient-to-br from-pastel-purple-100 to-pastel-pink-100 flex items-center justify-center shadow-cute border border-pastel-purple-200">
            <span className="text-4xl select-none animate-bounce-slow" role="img" aria-label="sad face">🥺</span>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-slate-800 mb-1 tracking-tight">
            Limit Habis, Bestie!
          </h2>
          <p className="text-xs font-semibold text-pastel-purple-400 uppercase tracking-widest mb-5">
            Kuota Chat Kamu Sudah Habis
          </p>

          {/* Message */}
          <div className="bg-gradient-to-br from-pastel-purple-50 to-pastel-pink-50 rounded-2xl p-5 border border-pastel-purple-100 text-left mb-6">
            <p className="text-sm text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-700">Izin!</span> Kamu udah pakai limit nanya kamu{' '}
              <span className="font-bold text-pastel-purple-400">5x</span> sampai habis.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed mt-3">
              Karena web masih dikembangkan dan belum ada fitur payment otomatis. Untuk lanjut nanya saat ini, silakan chat akun discord developer:
            </p>
            <div className="mt-3 flex items-center gap-2 bg-white rounded-xl px-4 py-3 border border-pastel-purple-200 shadow-sm">
              <span className="text-lg">💬</span>
              <span className="font-bold text-slate-700 text-sm">@faizfahsai</span>
              <span className="text-xs text-slate-400 ml-auto">Discord</span>
            </div>
            <p className="text-xs text-slate-400 mt-3 italic text-center">
              siapa tahu dikasih token gratis awokawok 😄
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-sm transition-all duration-200"
            >
              Tutup
            </button>
            <a
              href="https://discord.com/users/faizfahsai"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-400 to-purple-500 hover:from-indigo-500 hover:to-purple-600 text-white font-semibold text-sm shadow-cute transition-all duration-200 hover:shadow-cute-lg hover:-translate-y-0.5 flex items-center justify-center gap-1.5"
            >
              <ExternalLink size={14} />
              Discord
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
