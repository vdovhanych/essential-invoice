import React, { useState, useEffect } from 'react';
import { useAI } from '../context/AIContext';

export default function AIAssistant() {
  const { aiStatus, checkAIStatus, askTaxAdvisor, loading } = useAI();
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [conversation, setConversation] = useState<Array<{ type: 'user' | 'assistant'; text: string }>>([]);

  useEffect(() => {
    checkAIStatus();
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
        { type: 'assistant', text: `Error: ${err.message}` },
      ]);
    }
  };

  if (!aiStatus?.available) {
    return null;
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-full p-4 shadow-lg hover:from-indigo-700 hover:to-purple-700 transition-all z-50"
        title="AI Assistant (Powered by Perplexity)"
      >
        {/* Perplexity Logo - Stylized cube/hexagon */}
        <svg
          className="w-6 h-6"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.5l7.5 3.75v7.5L12 19.5l-7.5-3.75v-7.5L12 4.5z" />
          <path d="M12 7l-5 2.5v5l5 2.5 5-2.5v-5L12 7zm0 2l3 1.5v3l-3 1.5-3-1.5v-3L12 9z" opacity="0.7" />
        </svg>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl sm:mx-4 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-t-2xl">
              <div className="flex items-center space-x-2">
                {/* Perplexity Logo */}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-lg p-2">
                  <svg
                    className="w-5 h-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.5l7.5 3.75v7.5L12 19.5l-7.5-3.75v-7.5L12 4.5z" />
                    <path d="M12 7l-5 2.5v5l5 2.5 5-2.5v-5L12 7zm0 2l3 1.5v3l-3 1.5-3-1.5v-3L12 9z" opacity="0.7" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">AI Assistant</h2>
                <span className="px-2 py-1 text-xs bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 text-indigo-800 dark:text-indigo-300 rounded-full font-medium">
                  Powered by Perplexity
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Conversation */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {conversation.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <p className="mb-4">Ask me anything about Czech tax and accounting!</p>
                  <div className="space-y-2 text-sm text-left max-w-md mx-auto">
                    <button
                      onClick={() => setQuestion('When do I need to file VAT returns?')}
                      className="block w-full text-left p-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300"
                    >
                      💬 When do I need to file VAT returns?
                    </button>
                    <button
                      onClick={() => setQuestion('What are health insurance rates for freelancers?')}
                      className="block w-full text-left p-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300"
                    >
                      💬 What are health insurance rates for freelancers?
                    </button>
                    <button
                      onClick={() => setQuestion('Should I use paušální daň?')}
                      className="block w-full text-left p-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300"
                    >
                      💬 Should I use paušální daň?
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
                      className={`max-w-[80%] p-3 rounded-lg ${
                        msg.type === 'user'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))
              )}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 p-3 rounded-lg">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce delay-100"></div>
                      <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce delay-200"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about Czech taxes, VAT, insurance..."
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  maxLength={500}
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !question.trim()}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Powered by Perplexity AI with real-time web search
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
