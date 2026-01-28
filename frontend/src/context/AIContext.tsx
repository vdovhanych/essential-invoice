import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

interface AIFeatures {
  available: boolean;
  features: {
    invoiceCategorization: boolean;
    paymentMatching: boolean;
    taxAdvisor: boolean;
  };
}

interface AIContextType {
  aiStatus: AIFeatures | null;
  loading: boolean;
  error: string | null;
  checkAIStatus: () => Promise<void>;
  categorizeInvoice: (invoiceId: string) => Promise<any>;
  matchPaymentAI: (paymentId: string) => Promise<any>;
  askTaxAdvisor: (question: string) => Promise<any>;
}

const AIContext = createContext<AIContextType | undefined>(undefined);

export function AIProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [aiStatus, setAIStatus] = useState<AIFeatures | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAIStatus = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch('http://localhost:3001/api/ai/status', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAIStatus(data);
      }
    } catch (err) {
      console.error('Failed to check AI status:', err);
    }
  }, [token]);

  const categorizeInvoice = useCallback(
    async (invoiceId: string) => {
      if (!token) throw new Error('Not authenticated');

      setLoading(true);
      setError(null);

      try {
        const response = await fetch('http://localhost:3001/api/ai/categorize-invoice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ invoiceId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to categorize invoice');
        }

        const data = await response.json();
        return data.categories;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const matchPaymentAI = useCallback(
    async (paymentId: string) => {
      if (!token) throw new Error('Not authenticated');

      setLoading(true);
      setError(null);

      try {
        const response = await fetch('http://localhost:3001/api/ai/match-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ paymentId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to match payment');
        }

        const data = await response.json();
        return data.match;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const askTaxAdvisor = useCallback(
    async (question: string) => {
      if (!token) throw new Error('Not authenticated');

      setLoading(true);
      setError(null);

      try {
        const response = await fetch('http://localhost:3001/api/ai/tax-advisor', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ question }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to get tax advice');
        }

        const data = await response.json();
        return data;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  return (
    <AIContext.Provider
      value={{
        aiStatus,
        loading,
        error,
        checkAIStatus,
        categorizeInvoice,
        matchPaymentAI,
        askTaxAdvisor,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  const context = useContext(AIContext);
  if (context === undefined) {
    throw new Error('useAI must be used within AIProvider');
  }
  return context;
}
