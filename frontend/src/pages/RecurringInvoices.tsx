import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { formatCurrency, formatDate } from '../utils/format';
import { Plus, Repeat, Play, Pause, Trash2 } from 'lucide-react';

interface RecurringInvoice {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  currency: string;
  vatRate: number;
  dayOfMonth: number;
  startDate: string;
  endDate: string | null;
  nextGenerationDate: string;
  paymentTerms: number;
  autoSend: boolean;
  active: boolean;
  subtotal: number;
  createdAt: string;
}

export default function RecurringInvoices() {
  const [templates, setTemplates] = useState<RecurringInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const result = await api.get('/recurring-invoices');
      setTemplates(result);
    } catch (error) {
      console.error('Failed to load recurring invoices:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(id: string) {
    try {
      await api.post(`/recurring-invoices/${id}/toggle`);
      loadTemplates();
    } catch (error) {
      console.error('Failed to toggle recurring invoice:', error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Opravdu chcete smazat tuto opakovanou fakturu?')) return;
    try {
      await api.delete(`/recurring-invoices/${id}`);
      loadTemplates();
    } catch (error) {
      console.error('Failed to delete recurring invoice:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {templates.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Kontakt</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Částka</th>
                <th className="text-center py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Den v měsíci</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Další generování</th>
                <th className="text-center py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Auto-odeslání</th>
                <th className="text-center py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Stav</th>
                <th className="text-right py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Akce</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="py-3 px-4">
                    <Link
                      to={`/recurring/${template.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {template.clientName}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {formatCurrency(template.subtotal * (1 + template.vatRate / 100), template.currency)}
                  </td>
                  <td className="py-3 px-4 text-center">{template.dayOfMonth}.</td>
                  <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                    {formatDate(template.nextGenerationDate)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {template.autoSend ? (
                      <span className="badge bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">Ano</span>
                    ) : (
                      <span className="badge bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">Ne</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {template.active ? (
                      <span className="badge bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Aktivní</span>
                    ) : (
                      <span className="badge bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Pozastaveno</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <button
                        onClick={() => handleToggle(template.id)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                        title={template.active ? 'Pozastavit' : 'Aktivovat'}
                      >
                        {template.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                        title="Smazat"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <Repeat className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Žádné opakované faktury</p>
          <Link to="/recurring/new" className="btn btn-primary mt-4 inline-flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Vytvořit opakovanou fakturu</span>
          </Link>
        </div>
      )}
    </div>
  );
}
