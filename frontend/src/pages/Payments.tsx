import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';
import { CreditCard, Search, Link2, Unlink, AlertCircle, CheckCircle, X, RefreshCw } from 'lucide-react';

interface Payment {
  id: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  variableSymbol: string | null;
  senderName: string | null;
  senderAccount: string | null;
  message: string | null;
  transactionCode: string | null;
  transactionDate: string;
  matchedAt: string | null;
  matchMethod: string | null;
}

interface PotentialMatch {
  id: string;
  invoiceNumber: string;
  variableSymbol: string;
  clientName: string;
  total: number;
  currency: string;
  issueDate: string;
  matchScore: number;
  matchReason: string;
}

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingEmails, setCheckingEmails] = useState(false);
  const [filter, setFilter] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Match modal state
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [potentialMatches, setPotentialMatches] = useState<PotentialMatch[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);

  useEffect(() => {
    loadPayments();
  }, [filter]);

  async function loadPayments() {
    try {
      let url = '/payments';
      if (filter === 'matched') url += '?matched=true';
      else if (filter === 'unmatched') url += '?matched=false';

      const result = await api.get(url);
      setPayments(result);
    } catch (error) {
      console.error('Failed to load payments:', error);
    } finally {
      setLoading(false);
    }
  }

  async function openMatchModal(payment: Payment) {
    setSelectedPayment(payment);
    setShowMatchModal(true);
    setMatchLoading(true);

    try {
      const matches = await api.get(`/payments/${payment.id}/matches`);
      setPotentialMatches(matches);
    } catch (error) {
      console.error('Failed to load matches:', error);
      setPotentialMatches([]);
    } finally {
      setMatchLoading(false);
    }
  }

  async function handleMatch(invoiceId: string) {
    if (!selectedPayment) return;

    try {
      await api.post(`/payments/${selectedPayment.id}/match`, { invoiceId });
      setMessage({ type: 'success', text: 'Platba byla spárována' });
      setShowMatchModal(false);
      loadPayments();
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ type: 'error', text: error.message || 'Nepodařilo se spárovat platbu' });
    }
  }

  async function handleUnmatch(payment: Payment) {
    if (!confirm('Opravdu chcete zrušit spárování této platby?')) return;

    try {
      await api.post(`/payments/${payment.id}/unmatch`);
      setMessage({ type: 'success', text: 'Spárování bylo zrušeno' });
      loadPayments();
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ type: 'error', text: error.message || 'Nepodařilo se zrušit spárování' });
    }
  }

  async function checkForNewPayments() {
    setCheckingEmails(true);
    setMessage(null);

    try {
      await api.post('/payments/check-emails');
      setMessage({ 
        type: 'success', 
        text: 'Kontrola emailů dokončena. Pokud byly nalezeny nové platby, zobrazí se v seznamu.' 
      });
      loadPayments(); // Reload payments to show new ones
    } catch (err: unknown) {
      const error = err as Error;
      setMessage({ 
        type: 'error', 
        text: error.message || 'Nepodařilo se zkontrolovat emaily. Zkontrolujte nastavení IMAP.' 
      });
    } finally {
      setCheckingEmails(false);
    }
  }

  const filteredPayments = payments.filter(payment =>
    (payment.variableSymbol?.includes(search) ||
     payment.senderName?.toLowerCase().includes(search.toLowerCase()) ||
     payment.invoiceNumber?.includes(search))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Platby z banky</h1>
        <button
          onClick={checkForNewPayments}
          disabled={checkingEmails}
          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          title="Zkontrolovat nové platby z emailu"
        >
          <RefreshCw className={`w-5 h-5 ${checkingEmails ? 'animate-spin' : ''}`} />
          <span>{checkingEmails ? 'Kontroluji...' : 'Zkontrolovat emaily'}</span>
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center space-x-2 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Hledat platby..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Všechny
          </button>
          <button
            onClick={() => setFilter('unmatched')}
            className={`btn ${filter === 'unmatched' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Nespárované
          </button>
          <button
            onClick={() => setFilter('matched')}
            className={`btn ${filter === 'matched' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Spárované
          </button>
        </div>
      </div>

      {/* Payments list */}
      <div className="card overflow-hidden">
        {filteredPayments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Datum</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Odesílatel</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">VS</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Částka</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">Faktura</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">Akce</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-600">
                      {formatDate(payment.transactionDate)}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{payment.senderName || '-'}</p>
                        {payment.message && (
                          <p className="text-sm text-gray-500 truncate max-w-xs">{payment.message}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-600">
                      {payment.variableSymbol || '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-green-600">
                      +{formatCurrency(payment.amount, payment.currency)}
                    </td>
                    <td className="py-3 px-4">
                      {payment.invoiceId ? (
                        <Link
                          to={`/invoices/${payment.invoiceId}`}
                          className="text-blue-600 hover:underline flex items-center space-x-1"
                        >
                          <Link2 className="h-4 w-4" />
                          <span>{payment.invoiceNumber}</span>
                        </Link>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {payment.invoiceId ? (
                        <button
                          onClick={() => handleUnmatch(payment)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Zrušit spárování"
                        >
                          <Unlink className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => openMatchModal(payment)}
                          className="btn btn-secondary text-sm py-1 px-3"
                        >
                          Sparovat
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Žádné platby nenalezeny</p>
            <p className="text-sm text-gray-400 mt-2">
              Platby se automaticky načítají z vašeho emailu
            </p>
          </div>
        )}
      </div>

      {/* Match modal */}
      {showMatchModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Spárovat platbu</h2>
              <button onClick={() => setShowMatchModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Payment details */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Částka:</span>
                  <span className="ml-2 font-medium text-green-600">
                    {formatCurrency(selectedPayment.amount, selectedPayment.currency)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">VS:</span>
                  <span className="ml-2 font-mono">{selectedPayment.variableSymbol || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Odesílatel:</span>
                  <span className="ml-2">{selectedPayment.senderName || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Datum:</span>
                  <span className="ml-2">{formatDate(selectedPayment.transactionDate)}</span>
                </div>
              </div>
            </div>

            {/* Potential matches */}
            <h3 className="font-medium text-gray-900 mb-3">Možné shody</h3>
            {matchLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : potentialMatches.length > 0 ? (
              <div className="space-y-2">
                {potentialMatches.map(match => (
                  <div
                    key={match.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{match.invoiceNumber}</span>
                        <span className={`badge ${
                          match.matchScore >= 80 ? 'bg-green-100 text-green-800' :
                          match.matchScore >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {match.matchScore}% shoda
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{match.clientName}</p>
                      <p className="text-sm text-gray-500">
                        VS: {match.variableSymbol} | {formatDate(match.issueDate)} | {formatCurrency(match.total, match.currency)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleMatch(match.id)}
                      className="btn btn-primary"
                    >
                      Spárovat
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Nebyly nalezeny žádné odpovídající faktury
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
