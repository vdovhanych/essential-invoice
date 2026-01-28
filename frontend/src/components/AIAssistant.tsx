import React, { useState, useEffect } from 'react';
import { useAI } from '../context/AIContext';

export default function AIAssistant() {
  const { aiStatus, checkAIStatus, askTaxAdvisor, getFinancialInsights, loading } = useAI();
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [conversation, setConversation] = useState<Array<{ type: 'user' | 'assistant'; text: string }>>([]);
  const [insights, setInsights] = useState<string | null>(null);

  useEffect(() => {
    checkAIStatus();
  }, [checkAIStatus]);

  useEffect(() => {
    if (isOpen && !insights) {
      loadInsights();
    }
  }, [isOpen]);

  const loadInsights = async () => {
    try {
      const result = await getFinancialInsights();
      setInsights(result);
    } catch (err) {
      console.error('Failed to load insights:', err);
    }
  };

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
        className="fixed bottom-6 right-6 bg-indigo-600 text-white rounded-full p-4 shadow-lg hover:bg-indigo-700 transition-colors z-50"
        title="AI Assistant"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl sm:mx-4 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center space-x-2">
                <svg
                  className="w-6 h-6 text-indigo-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                <h2 className="text-lg font-semibold">AI Assistant</h2>
                <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                  Powered by Perplexity
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
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

            {/* Insights Section */}
            {insights && (
              <div className="p-4 bg-indigo-50 border-b">
                <h3 className="text-sm font-semibold text-indigo-900 mb-2">
                  📊 Financial Insights
                </h3>
                <p className="text-sm text-indigo-800">{insights}</p>
              </div>
            )}

            {/* Conversation */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {conversation.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <p className="mb-4">Ask me anything about Czech tax and accounting!</p>
                  <div className="space-y-2 text-sm text-left max-w-md mx-auto">
                    <button
                      onClick={() => setQuestion('When do I need to file VAT returns?')}
                      className="block w-full text-left p-2 bg-gray-50 hover:bg-gray-100 rounded"
                    >
                      💬 When do I need to file VAT returns?
                    </button>
                    <button
                      onClick={() => setQuestion('What are health insurance rates for freelancers?')}
                      className="block w-full text-left p-2 bg-gray-50 hover:bg-gray-100 rounded"
                    >
                      💬 What are health insurance rates for freelancers?
                    </button>
                    <button
                      onClick={() => setQuestion('Should I use paušální daň?')}
                      className="block w-full text-left p-2 bg-gray-50 hover:bg-gray-100 rounded"
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
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))
              )}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 text-gray-900 p-3 rounded-lg">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about Czech taxes, VAT, insurance..."
                  className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  maxLength={500}
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !question.trim()}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Powered by Perplexity AI with real-time web search
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
