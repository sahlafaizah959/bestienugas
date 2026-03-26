/**
 * Sidebar.tsx
 *
 * Collapsible chat history sidebar — works on all screen sizes.
 * Default state: collapsed (icon-only strip, w-14).
 * Expanded state: full width (w-64) with session titles.
 *
 * Props:
 *  - sessions: Session[]          — real-time list from useSessions hook
 *  - activeSessionId: string|null — currently selected session
 *  - isOpen: boolean              — controlled by parent (App.tsx)
 *  - onToggle: () => void         — toggle open/closed
 *  - onNewChat: () => void        — reset chat state
 *  - onSelectSession: (s) => void — load a session
 *  - onDeleteSession: (id) => void
 *  - onClearAll: () => void
 *  - isLoggedIn: boolean          — hide history features when logged out
 */

import React from 'react';
import {
  PlusCircle,
  MessageSquare,
  Trash2,
  ChevronRight,
  ChevronLeft,
  History,
  AlertTriangle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Session } from '../types';

interface SidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  onSelectSession: (session: Session) => void;
  onDeleteSession: (sessionId: string) => void;
  onClearAll: () => void;
  isLoggedIn: boolean;
  sessionsLoading: boolean;
}

/** Format a Unix ms timestamp to a relative label */
const formatRelativeTime = (ms: number): string => {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} mnt lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  if (days === 1) return 'Kemarin';
  return `${days} hari lalu`;
};

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  isOpen,
  onToggle,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onClearAll,
  isLoggedIn,
  sessionsLoading,
}) => {
  return (
    <aside
      className={clsx(
        'relative flex flex-col h-full bg-brand-50 text-slate-100 shrink-0',
        'transition-all duration-300 ease-in-out overflow-hidden',
        isOpen ? 'w-64' : 'w-14'
      )}
    >
      {/* ── Toggle button ── */}
      <button
        onClick={onToggle}
        title={isOpen ? 'Tutup sidebar' : 'Buka sidebar'}
        className={clsx(
          'absolute top-3 z-10 flex items-center justify-center',
          'w-7 h-7 rounded-full bg-slate-700 hover:bg-slate-600',
          'text-slate-300 hover:text-white transition-colors shadow-md',
          isOpen ? 'right-3' : 'right-1.5'
        )}
      >
        {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* ── Header / New Chat ── */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-slate-700/60 min-h-[52px]">
        <button
          onClick={onNewChat}
          title="Chat baru"
          className={clsx(
            'flex items-center gap-2 rounded-lg px-2 py-2',
            'bg-brand-600 hover:bg-brand-700 text-white',
            'transition-colors shrink-0',
            isOpen ? 'w-full justify-start' : 'w-8 h-8 justify-center p-0'
          )}
        >
          <PlusCircle size={16} className="shrink-0" />
          {isOpen && <span className="text-xs font-semibold whitespace-nowrap">Chat Baru</span>}
        </button>
      </div>

      {/* ── Session list ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
        {!isLoggedIn ? (
          /* Not logged in — show hint */
          <div className={clsx('px-3 py-4 text-center', !isOpen && 'hidden')}>
            <History size={24} className="mx-auto mb-2 text-slate-500" />
            <p className="text-xs text-slate-500">Login untuk lihat riwayat chat</p>
          </div>
        ) : sessionsLoading ? (
          /* Loading skeleton */
          <div className="space-y-1 px-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={clsx(
                  'h-9 rounded-lg bg-slate-700/50 animate-pulse',
                  isOpen ? 'w-full' : 'w-8 mx-auto'
                )}
              />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          /* Empty state */
          <div className={clsx('px-3 py-4 text-center', !isOpen && 'hidden')}>
            <MessageSquare size={24} className="mx-auto mb-2 text-slate-600" />
            <p className="text-xs text-slate-500">Belum ada riwayat chat</p>
          </div>
        ) : (
          /* Session items */
          <ul className="space-y-0.5 px-1.5">
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <li key={session.id}>
                  <div
                    className={clsx(
                      'group flex items-center gap-2 rounded-lg cursor-pointer',
                      'transition-colors duration-150',
                      isOpen ? 'px-2 py-2' : 'px-1 py-2 justify-center',
                      isActive
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'text-brand-900 hover:bg-brand-600 hover:text-white'
                    )}
                    onClick={() => onSelectSession(session)}
                    title={!isOpen ? session.title : undefined}
                  >
                    {/* Icon */}
                    <MessageSquare
                      size={15}
                      className={clsx('shrink-0', isActive ? 'text-brand-300' : 'text-slate-400')}
                    />

                    {/* Title + time — only visible when expanded */}
                    {isOpen && (
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate leading-tight">
                          {session.title}
                        </p>
                        <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                          {formatRelativeTime(session.createdAt)}
                        </p>
                      </div>
                    )}

                    {/* Delete button — only visible when expanded + hover */}
                    {isOpen && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                        title="Hapus sesi ini"
                        className={clsx(
                          'shrink-0 p-1 rounded opacity-0 group-hover:opacity-100',
                          'text-slate-500 hover:text-red-400 hover:bg-red-900/30',
                          'transition-all duration-150'
                        )}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Footer: Clear All ── */}
      {isLoggedIn && sessions.length > 0 && isOpen && (
        <div className="border-t border-slate-700/60 px-3 py-2">
          <button
            onClick={onClearAll}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors w-full py-1"
          >
            <AlertTriangle size={12} />
            <span>Hapus semua riwayat</span>
          </button>
        </div>
      )}
    </aside>
  );
};
