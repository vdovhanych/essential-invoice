import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getExpenseStatusLabel, getExpenseStatusColor } from '../utils/format';
import { Plus, Search, Filter, Receipt } from 'lucide-react';

interface Expense {
  id: string;
  expenseNumber: string;
  supplierInvoiceNumber: string | null;
  status: string;
  currency: string;
  clientId: string | null;
  clientName: string | null;
  issueDate: string;
  dueDate: string;
  total: number;
  hasFile: boolean;
}

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadExpenses();
  }, [statusFilter]);

  async function loadExpenses() {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);

      const result = await api.get(`/expenses?${params}`);
      setExpenses(result);
    } catch (error) {
      console.error('Failed to load expenses:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredExpenses = expenses.filter(expense =>
    expense.expenseNumber.toLowerCase().includes(search.toLowerCase()) ||
    (expense.clientName && expense.clientName.toLowerCase().includes(search.toLowerCase())) ||
    (expense.supplierInvoiceNumber && expense.supplierInvoiceNumber.toLowerCase().includes(search.toLowerCase()))
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Náklady</h1>
        <Link to="/expenses/new" className="btn btn-primary flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Nový náklad</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Hledat náklady..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-auto"
          >
            <option value="">Všechny stavy</option>
            <option value="unpaid">Nezaplaceno</option>
            <option value="paid">Zaplaceno</option>
          </select>
        </div>
      </div>

      {/* Expense list */}
      <div className="card overflow-hidden">
        {filteredExpenses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Číslo</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Dodavatel</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Číslo faktury</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Datum přijetí</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Splatnost</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Částka</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Stav</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-3 px-4">
                      <Link
                        to={`/expenses/${expense.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {expense.expenseNumber}
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      {expense.clientId && expense.clientName ? (
                        <Link
                          to={`/clients/${expense.clientId}`}
                          className="text-gray-900 dark:text-gray-100 hover:underline"
                        >
                          {expense.clientName}
                        </Link>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                      {expense.supplierInvoiceNumber || '-'}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{formatDate(expense.issueDate)}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{formatDate(expense.dueDate)}</td>
                    <td className="py-3 px-4 text-right font-medium">
                      {formatCurrency(expense.total, expense.currency)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`badge ${getExpenseStatusColor(expense.status)}`}>
                        {getExpenseStatusLabel(expense.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Receipt className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Žádné náklady nenalezeny</p>
            <Link to="/expenses/new" className="btn btn-primary mt-4 inline-flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Přidat první náklad</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
