import React from 'react';
import { X, Heart } from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-blue-900/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white rounded-4xl shadow-cute-lg border border-pastel-blue-200 overflow-hidden animate-slide-up">
        
        {/* Top gradient strip */}
        <div className="h-2 w-full bg-gradient-to-r from-pastel-blue-300 via-pastel-purple-300 to-pastel-mint-300" />

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
          {/* Bestie Nugas Logo */}
          <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-brand-400 flex items-center justify-center shadow-cute border border-brand-200 transition-transform hover:scale-105">
  {/* Mengganti emoji dengan ikon SVG yang bisa diubah warnanya jadi putih pekat */}
  <Heart size={42} className="text-white fill-white" /> 
</div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-slate-800 mb-1 tracking-tight">
            Halo Bestie! 💙
          </h2>
          <p className="text-xs font-semibold text-pastel-blue-400 uppercase tracking-widest mb-5">
            Selamat Datang di Bestie Nugas
          </p>

          {/* Message */}
          <div className="bg-gradient-to-br from-pastel-blue-50 to-pastel-purple-50 rounded-2xl p-5 border border-pastel-blue-100 text-left mb-6">
            <p className="text-sm text-slate-600 leading-relaxed">
              Web ini masih dalam pengembangan, tapi kamu bisa coba fitur-fitur web ini dengan{' '}
              <span className="font-semibold text-pastel-blue-400">login</span> untuk sekarang.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed mt-3">
              Untuk ke depannya developer membuat beberapa perubahan pada web.
            </p>
            <p className="text-sm text-slate-700 font-semibold leading-relaxed mt-3">
              Thanks Bestie! Happy nugas! 🎉
            </p>
          </div>

          {/* CTA Button */}
            <button
              onClick={onClose}
              className="w-full py-3 px-6 rounded-2xl bg-brand-500 hover:from-brand-600 hover:to-brand-700 text-white font-semibold text-sm shadow-cute transition-all duration-200 hover:shadow-cute-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              Oke Bestie! 🫶
            </button>
        </div>
      </div>
    </div>
  );
};
