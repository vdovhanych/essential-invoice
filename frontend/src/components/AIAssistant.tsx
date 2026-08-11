import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, X, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAI } from '../context/AIContext';

const markdownComponents = {
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="text-sm mb-2 last:mb-0" {...props} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="text-sm list-disc pl-5 mb-2 last:mb-0 space-y-1" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="text-sm list-decimal pl-5 mb-2 last:mb-0 space-y-1" {...props} />
  ),
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-sm font-semibold mb-1" {...props} />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-sm font-semibold mb-1" {...props} />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-sm font-semibold mb-1" {...props} />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      className="text-accent underline break-words"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  code: (props: React.HTMLAttributes<HTMLElement>) => (
    <code className="text-xs font-mono bg-surface-sunken rounded px-1 py-0.5 text-text" {...props} />
  ),
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre className="text-xs bg-surface-sunken rounded p-2 mb-2 overflow-x-auto" {...props} />
  ),
  blockquote: (props: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) => (
    <blockquote className="border-l-2 border-border-strong pl-3 mb-2 last:mb-0" {...props} />
  ),
};

export default function AIAssistant() {
  const { t } = useTranslation('common');
  const { aiStatus, checkAIStatus, askTaxAdvisor, loading, assistantOpen, openAssistant, closeAssistant } = useAI();
  const [question, setQuestion] = useState('');
  const [conversation, setConversation] = useState<Array<{ type: 'user' | 'assistant'; text: string }>>([]);

  useEffect(() => {
    checkAIStatus();

    const handleSettingsUpdate = () => checkAIStatus();
    window.addEventListener('settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('settings-updated', handleSettingsUpdate);
  }, [checkAIStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    const userQuestion = question.trim();
    setQuestion('');
    setConversation((prev) => [...prev, { type: 'user', text: userQuestion }]);

    try {
      const response = await askTaxAdvisor(userQuestion);
      setConversation((prev) => [...prev, { type: 'assistant', text: response.answer }]);
    } catch (err: any) {
      setConversation((prev) => [
        ...prev,
        { type: 'assistant', text: t('ai.error', { message: err.message }) },
      ]);
    }
  };

  if (!aiStatus?.available) {
    return null;
  }

  return (
    <>
      {/* Floating button (desktop only; mobile opens the assistant from the More menu) */}
      <button
        onClick={() => (assistantOpen ? closeAssistant() : openAssistant())}
        className="hidden lg:flex fixed bottom-6 right-6 h-12 w-12 items-center justify-center bg-accent text-white rounded-[15px] shadow-[0_6px_16px_-6px_rgba(79,70,229,.8)] hover:bg-accent-hover transition-colors z-50"
        title={t('ai.title')}
      >
        <Sparkles className="w-5 h-5" />
      </button>

      {/* Modal */}
      {assistantOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-surface border border-border-strong rounded-t-[18px] sm:rounded-[18px] shadow-[0_30px_60px_-20px_rgba(27,29,41,.35)] w-full sm:max-w-2xl sm:mx-4 max-h-[80vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-[18px] py-4 border-b border-hairline">
              <div className="flex items-center space-x-2">
                <span className="flex items-center justify-center h-8 w-8 rounded-[10px] bg-accent-tint text-accent">
                  <Sparkles className="w-4 h-4" />
                </span>
                <h2 className="text-[15px] font-semibold text-text">{t('ai.title')}</h2>
              </div>
              <button
                onClick={closeAssistant}
                className="p-1.5 rounded-lg text-text-faint hover:text-text hover:bg-nav-hover transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conversation */}
            <div className="flex-1 overflow-y-auto px-[18px] py-4 space-y-4">
              {conversation.length === 0 ? (
                <div className="text-center text-text-muted py-8">
                  <p className="mb-4 text-sm">{t('ai.placeholder')}</p>
                  <div className="space-y-2 text-sm text-left max-w-md mx-auto">
                    <button
                      onClick={() => setQuestion(t('ai.exampleVat'))}
                      className="block w-full text-left px-3.5 py-2.5 bg-surface-sunken hover:bg-nav-hover rounded-[10px] text-[13px] text-text-secondary transition-colors"
                    >
                      💬 {t('ai.exampleVat')}
                    </button>
                    <button
                      onClick={() => setQuestion(t('ai.exampleInsurance'))}
                      className="block w-full text-left px-3.5 py-2.5 bg-surface-sunken hover:bg-nav-hover rounded-[10px] text-[13px] text-text-secondary transition-colors"
                    >
                      💬 {t('ai.exampleInsurance')}
                    </button>
                    <button
                      onClick={() => setQuestion(t('ai.examplePausalni'))}
                      className="block w-full text-left px-3.5 py-2.5 bg-surface-sunken hover:bg-nav-hover rounded-[10px] text-[13px] text-text-secondary transition-colors"
                    >
                      💬 {t('ai.examplePausalni')}
                    </button>
                  </div>
                </div>
              ) : (
                conversation.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] px-3.5 py-2.5 text-sm ${
                        msg.type === 'user'
                          ? 'bg-accent text-white rounded-[14px] rounded-br-[4px]'
                          : 'bg-surface-sunken text-text rounded-[14px] rounded-bl-[4px]'
                      }`}
                    >
                      {msg.type === 'assistant' ? (
                        <ReactMarkdown components={markdownComponents}>{msg.text}</ReactMarkdown>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-surface-sunken text-text px-3.5 py-3 rounded-[14px] rounded-bl-[4px]">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-text-faint rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-text-faint rounded-full animate-bounce delay-100"></div>
                      <div className="w-2 h-2 bg-text-faint rounded-full animate-bounce delay-200"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="px-[18px] py-4 border-t border-hairline">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t('ai.placeholder')}
                  className="input flex-1"
                  maxLength={500}
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !question.trim()}
                  className="btn btn-primary flex items-center gap-2 shrink-0"
                >
                  <Send className="w-4 h-4" />
                  {t('ai.send')}
                </button>
              </div>
              <p className="text-xs text-text-faint mt-2">
                {t('ai.disclaimer')}
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
