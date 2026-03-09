import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, Sender } from '../types';
import { User, Bot, BookOpenCheck } from 'lucide-react';
import { clsx } from 'clsx';

interface ChatMessageProps {
  message: Message;
  onCitationClick?: (filename: string, page: number, text: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onCitationClick }) => {
  const isAI = message.sender === Sender.AI;

  return (
    <div className={clsx("flex w-full mb-6", isAI ? "justify-start" : "justify-end")}>
      <div className={clsx("flex max-w-[95%] md:max-w-[85%]", isAI ? "flex-row" : "flex-row-reverse")}>
        
        {/* Avatar */}
        <div className={clsx(
          "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center mt-1",
          isAI ? "bg-brand-100 text-brand-600 mr-3" : "bg-slate-200 text-slate-600 ml-3"
        )}>
          {isAI ? <Bot size={18} /> : <User size={18} />}
        </div>

        {/* Bubble */}
        <div className={clsx(
          "p-4 rounded-2xl text-sm shadow-sm overflow-hidden",
          isAI 
            ? "bg-white border border-slate-200 text-slate-800 rounded-tl-none" 
            : "bg-brand-600 text-white rounded-tr-none"
        )}>
          {isAI ? (
            <div className="markdown-body">
              <ReactMarkdown
                urlTransform={(url) => url}
                components={{
                  a: ({ node, href, children, ...props }) => {
                    const cleanHref = href?.trim() || '';
                    // Looser check for citation: protocol (case insensitive)
                    const isCitation = /^citation:/i.test(cleanHref);

                    if (isCitation) {
                      return (
                        <a
                          href={cleanHref}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onCitationClick) {
                              try {
                                // Handles: citation:Name.pdf?page=1&text=foo
                                const rawPath = cleanHref.replace(/^citation:/i, '');
                                const [filePart, queryPart] = rawPath.split('?');
                                
                                const filename = decodeURIComponent(filePart);
                                const params = new URLSearchParams(queryPart);
                                const page = parseInt(params.get('page') || '1', 10);
                                const text = params.get('text') || '';
                                
                                onCitationClick(filename, page, text);
                              } catch (err) {
                                console.error("Failed to parse citation:", href);
                              }
                            }
                          }}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 text-xs font-medium text-brand-600 bg-brand-50 hover:bg-brand-100 rounded border border-brand-200 transition-colors cursor-pointer select-none no-underline hover:no-underline"
                          title="Klik untuk lihat bukti di PDF"
                          {...props}
                        >
                          {children}
                        </a>
                      );
                    }
                    // Normal links
                    return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" {...props}>{children}</a>;
                  }
                }}
              >
                {message.text}
              </ReactMarkdown>
              {message.isStreaming && (
                 <span className="inline-block w-2 h-4 ml-1 align-middle bg-brand-500 animate-pulse"/>
              )}
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.text}</p>
          )}

          {/* Citation Badge */}
          {isAI && !message.isStreaming && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center text-xs text-slate-400">
              <BookOpenCheck size={14} className="mr-1.5 text-green-500" />
              <span>Verified with clickable citations</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};