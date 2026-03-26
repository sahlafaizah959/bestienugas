import React from 'react';
import { X } from 'lucide-react';

interface StorageLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StorageLimitModal: React.FC<StorageLimitModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-yellow-900/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white rounded-4xl shadow-cute-lg border border-pastel-yellow-200 overflow-hidden animate-slide-up">
        
        {/* Top gradient strip */}
        <div className="h-2 w-full bg-gradient-to-r from-pastel-yellow-200 via-pastel-mint-200 to-pastel-blue-200" />

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
          <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-gradient-to-br from-pastel-yellow-100 to-pastel-mint-100 flex items-center justify-center shadow-cute border border-pastel-yellow-200">
            <span className="text-4xl select-none" role="img" aria-label="package">📦</span>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-slate-800 mb-1 tracking-tight">
            Storage Penuh, Bestie!
          </h2>
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-5">
            Riwayat Chat Sudah Mencapai Batas
          </p>

          {/* Message */}
          <div className="bg-gradient-to-br from-pastel-yellow-50 to-pastel-mint-50 rounded-2xl p-5 border border-pastel-yellow-100 text-left mb-6">
            <p className="text-sm text-slate-600 leading-relaxed">
              Riwayat chat kamu sudah mencapai batas{' '}
              <span className="font-bold text-amber-500">3MB</span>.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed mt-3">
              Chat kamu tetap bisa berjalan, tapi riwayat percakapan baru tidak akan disimpan lagi untuk sementara.
            </p>
            <div className="mt-4 flex items-start gap-2 bg-white rounded-xl px-4 py-3 border border-pastel-yellow-200">
              <span className="text-base mt-0.5">💡</span>
              <p className="text-xs text-slate-500 leading-relaxed">
                Hubungi developer <span className="font-semibold text-slate-700">@faizfahsai</span> di Discord untuk membersihkan riwayat kamu.
              </p>
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={onClose}
            className="w-full py-3 px-6 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-500 hover:to-yellow-500 text-white font-semibold text-sm shadow-cute transition-all duration-200 hover:shadow-cute-lg hover:-translate-y-0.5 active:translate-y-0"
          >
            Oke, Ngerti! 👍
          </button>
        </div>
      </div>
    </div>
  );
};
