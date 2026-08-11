import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '../utils/api';
import { formatCurrency, formatDate, getExpenseStatusLabel, getExpenseStatusColor } from '../utils/format';
import { PageLoader } from '../components/Spinner';
import {
  ArrowLeft,
  Edit,
  Trash2,
  CheckCircle,
  Download,
  XCircle
} from 'lucide-react';

interface Expense {
  id: string;
  expenseNumber: string;
  supplierInvoiceNumber: string | null;
  status: string;
  currency: string;
  clientId: string | null;
  clientName: string | null;
  clientAddress: string | null;
  clientIco: string | null;
  clientDic: string | null;
  clientEmail: string | null;
  issueDate: string;
  dueDate: string;
  deliveryDate: string | null;
  amount: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  description: string | null;
  notes: string | null;
  fileData: string | null;
  fileName: string | null;
  fileMimeType: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ExpenseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('expenses');
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExpense();
  }, [id]);

  async function loadExpense() {
    try {
      const result = await api.get(`/expenses/${id}`);
      setExpense(result);
    } catch (error) {
      console.error('Failed to load expense:', error);
      toast.error(t('common:errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkPaid() {
    try {
      await api.post(`/expenses/${id}/mark-paid`);
      toast.success(t('detail.toast.markedPaid'));
      loadExpense();
    } catch (error) {
      toast.error(t('detail.toast.markPaidFailed'));
    }
  }

  async function handleMarkUnpaid() {
    try {
      await api.post(`/expenses/${id}/mark-unpaid`);
      toast.success(t('detail.toast.markedUnpaid'));
      loadExpense();
    } catch (error) {
      toast.error(t('detail.toast.markUnpaidFailed'));
    }
  }

  async function handleDelete() {
    if (!confirm(t('detail.confirm.delete'))) return;
    try {
      await api.delete(`/expenses/${id}`);
      navigate('/expenses');
    } catch (error) {
      toast.error(t('detail.toast.deleteFailed'));
    }
  }

  async function handleDownloadFile() {
    if (!expense?.fileName) return;
    try {
      await api.download(`/expenses/${id}/file`, expense.fileName);
    } catch (error) {
      toast.error(t('detail.toast.downloadFailed'));
    }
  }

  if (loading) {
    return <PageLoader />;
  }

  if (!expense) {
    return <div className="text-center text-text-muted">{t('detail.notFound')}</div>;
  }

  return (
    <div>
      {/* Desktop header bar */}
      <div className="hidden lg:flex items-center gap-4 -mx-7 -mt-7 mb-6 h-[60px] px-7 bg-surface border-b border-border">
        <button
          onClick={() => navigate('/expenses')}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('list.title')}
        </button>
        <div className="h-4 w-px bg-border-strong" />
        <h1 className="text-base font-semibold text-text">
          {expense.clientName || t('detail.title', { number: expense.expenseNumber })}
        </h1>
        <span className={`badge ${getExpenseStatusColor(expense.status)}`}>
          {getExpenseStatusLabel(expense.status)}
        </span>
        <span className="text-xs text-text-faint tabular-nums">
          {t('detail.addedOn', { date: formatDate(expense.createdAt) })}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {expense.status === 'unpaid' && (
            <>
              <Link to={`/expenses/${id}/edit`} className="btn btn-secondary flex items-center space-x-2">
                <Edit className="h-4 w-4" />
                <span>{t('detail.actions.edit')}</span>
              </Link>
              <button onClick={handleMarkPaid} className="btn btn-primary flex items-center space-x-2">
                <CheckCircle className="h-4 w-4" />
                <span>{t('detail.actions.markPaid')}</span>
              </button>
            </>
          )}
          {expense.status === 'paid' && (
            <button onClick={handleMarkUnpaid} className="btn btn-secondary flex items-center space-x-2">
              <XCircle className="h-4 w-4" />
              <span>{t('detail.actions.markUnpaid')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile header */}
      <div className="lg:hidden space-y-3 mb-4">
        <button
          onClick={() => navigate('/expenses')}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('list.title')}
        </button>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold tracking-[-0.02em] text-text truncate">
            {expense.clientName || t('detail.title', { number: expense.expenseNumber })}
          </h1>
          {expense.status === 'unpaid' ? (
            <button onClick={handleMarkPaid} className="btn btn-primary shrink-0">
              {t('detail.actions.markPaid')}
            </button>
          ) : (
            <button onClick={handleMarkUnpaid} className="btn btn-secondary shrink-0">
              {t('detail.actions.markUnpaid')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 lg:gap-5">
        <div className="space-y-4">
          {/* Hero card: amount over label-value rows */}
          <div className="card">
            <p className="text-[13px] text-text-muted">{t('detail.amount.total')}</p>
            <p className="mt-1 text-[28px] leading-tight font-bold tracking-[-0.02em] text-text tabular-nums">
              {formatCurrency(expense.total, expense.currency)}
            </p>
            <dl className="mt-4 pt-4 border-t border-hairline space-y-3">
              <div className="flex justify-between">
                <dt className="text-[13px] text-text-muted">{t('detail.amount.taxBase')}</dt>
                <dd className="text-sm font-medium text-text tabular-nums">
                  {formatCurrency(expense.amount, expense.currency)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[13px] text-text-muted">{t('detail.amount.vat', { rate: expense.vatRate })}</dt>
                <dd className="text-sm font-medium text-text tabular-nums">
                  {formatCurrency(expense.vatAmount, expense.currency)}
                </dd>
              </div>
              {expense.description && (
                <div className="flex justify-between gap-4">
                  <dt className="text-[13px] text-text-muted shrink-0">{t('detail.description.title')}</dt>
                  <dd className="text-sm text-text-secondary text-right whitespace-pre-wrap">
                    {expense.description}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Supplier */}
          {expense.clientName && (
            <div className="card">
              <h2 className="text-[15px] font-semibold text-text mb-3">{t('detail.supplier.title')}</h2>
              <p className="text-sm font-medium text-text">{expense.clientName}</p>
              <div className="mt-1 space-y-0.5 text-[13px] text-text-secondary">
                {expense.clientAddress && <p className="whitespace-pre-line">{expense.clientAddress}</p>}
                {expense.clientIco && <p className="tabular-nums">{t('detail.supplier.ico', { value: expense.clientIco })}</p>}
                {expense.clientDic && <p className="tabular-nums">{t('detail.supplier.dic', { value: expense.clientDic })}</p>}
                {expense.clientEmail && <p>{t('detail.supplier.email', { value: expense.clientEmail })}</p>}
              </div>
            </div>
          )}

          {/* Notes */}
          {expense.notes && (
            <div className="card">
              <h2 className="text-[15px] font-semibold text-text mb-3">{t('detail.notes.title')}</h2>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{expense.notes}</p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Receipt */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] uppercase font-semibold tracking-[.04em] text-text-faint">
                {t('detail.attachment.title')}
              </h2>
              {expense.fileData && expense.fileName && (
                <button
                  onClick={handleDownloadFile}
                  className="flex items-center gap-1 text-[13px] text-accent-link hover:underline"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t('detail.attachment.download')}
                </button>
              )}
            </div>
            {expense.fileData && expense.fileName ? (
              <div className="bg-[#fdfdff] border border-hairline rounded-[12px] p-3">
                <p className="text-[11px] font-mono text-text-faint truncate mb-2">{expense.fileName}</p>
                {expense.fileMimeType === 'application/pdf' ? (
                  <object
                    data={`data:application/pdf;base64,${expense.fileData}`}
                    type="application/pdf"
                    className="w-full h-[400px] rounded"
                  >
                    <p className="p-4 text-text-muted text-center text-sm">
                      {t('detail.attachment.pdfNotSupported')}
                    </p>
                  </object>
                ) : (
                  <img
                    src={`data:${expense.fileMimeType};base64,${expense.fileData}`}
                    alt={expense.fileName}
                    className="max-w-full rounded"
                  />
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2.5 bg-danger-bg text-danger rounded-[12px] px-3.5 py-3 text-[13px]">
                {t('detail.attachment.missing')}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="card">
            <h2 className="text-[15px] font-semibold text-text mb-4">{t('detail.info.title')}</h2>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-[13px] text-text-muted">{t('detail.info.expenseNumber')}</dt>
                <dd className="text-sm font-medium text-text tabular-nums">{expense.expenseNumber}</dd>
              </div>
              {expense.supplierInvoiceNumber && (
                <div className="flex justify-between">
                  <dt className="text-[13px] text-text-muted">{t('detail.info.invoiceNumber')}</dt>
                  <dd className="text-sm font-medium text-text tabular-nums">{expense.supplierInvoiceNumber}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-[13px] text-text-muted">{t('detail.info.issueDate')}</dt>
                <dd className="text-sm font-medium text-text tabular-nums">{formatDate(expense.issueDate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[13px] text-text-muted">{t('detail.info.dueDate')}</dt>
                <dd className="text-sm font-medium text-text tabular-nums">{formatDate(expense.dueDate)}</dd>
              </div>
              {expense.paidAt && (
                <div className="flex justify-between">
                  <dt className="text-[13px] text-text-muted">{t('detail.info.paidAt')}</dt>
                  <dd className="text-sm font-medium text-text tabular-nums">{formatDate(expense.paidAt)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Destructive action — quiet text link */}
          <div className="px-1">
            <button onClick={handleDelete} className="flex items-center gap-1.5 text-[13px] text-danger hover:underline">
              <Trash2 className="h-3.5 w-3.5" />
              {t('detail.actions.delete')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
