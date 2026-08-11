import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Sparkles, RefreshCw, X, Send } from 'lucide-react';
import { useAI, type ReminderTone } from '../context/AIContext';
import { Spinner } from './Spinner';

const TONES: Exclude<ReminderTone, 'auto'>[] = ['friendly', 'neutral', 'firm'];

interface ReminderComposerProps {
  open: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
  overdueLabel: string | null;
  /** Sends the composed reminder; resolves when the mail is away */
  onSend: (subject: string, body: string) => Promise<void>;
}

/**
 * Reviewable reminder flow (§18): the draft is a starting point, not a preview.
 * Nothing is ever sent without the user pressing send.
 */
export default function ReminderComposer({
  open,
  onClose,
  invoiceId,
  invoiceNumber,
  overdueLabel,
  onSend,
}: ReminderComposerProps) {
  const { t } = useTranslation('invoices');
  const { draftReminder } = useAI();
  const [tone, setTone] = useState<Exclude<ReminderTone, 'auto'>>('friendly');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    if (open && !hasDraft) {
      generate('friendly');
    }
    if (!open) {
      setHasDraft(false);
      setSubject('');
      setBody('');
      setTone('friendly');
    }
  }, [open]);

  async function generate(nextTone: Exclude<ReminderTone, 'auto'>) {
    setDrafting(true);
    try {
      const draft = await draftReminder(invoiceId, nextTone);
      setSubject(draft.subject);
      setBody(draft.body);
      setHasDraft(true);
    } catch (err: unknown) {
      const error = err as Error;
      toast.error(error.message || t('reminder.draftFailed'));
    } finally {
      setDrafting(false);
    }
  }

  function handleToneChange(nextTone: Exclude<ReminderTone, 'auto'>) {
    setTone(nextTone);
    generate(nextTone);
  }

  async function handleSend() {
    setSending(true);
    try {
      await onSend(subject, body);
      onClose();
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-[18px] shadow-[0_30px_60px_-20px_rgba(27,29,41,.35)] w-full max-w-[620px] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header — the reason for the message sits next to its name */}
        <div className="flex items-center gap-2.5 px-[22px] py-4 border-b border-hairline">
          <h2 className="text-[15px] font-semibold text-text tabular-nums">
            {t('reminder.title', { number: invoiceNumber })}
          </h2>
          {overdueLabel && <span className="badge badge-overdue">{overdueLabel}</span>}
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg text-text-faint hover:text-text hover:bg-nav-hover transition-colors"
            aria-label={t('reminder.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-[22px] space-y-4">
          {/* Drafted-for-you pill + tone: the only knob */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 bg-accent-tint text-accent text-[11px] font-semibold rounded-full px-2.5 py-1">
              <Sparkles className="h-3 w-3" />
              {t('reminder.draftedForYou')}
            </span>
            <div className="flex bg-surface-sunken rounded-[9px] p-[3px]">
              {TONES.map((option) => (
                <button
                  key={option}
                  onClick={() => handleToneChange(option)}
                  disabled={drafting}
                  className={`px-3 py-1 text-[13px] font-medium rounded-[7px] transition-colors disabled:opacity-50 ${
                    tone === option
                      ? 'bg-surface shadow-[0_1px_2px_rgba(20,22,40,.08)] text-text'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {t(`reminder.tone.${option}`)}
                </button>
              ))}
            </div>
          </div>

          {drafting && !hasDraft ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          ) : (
            <>
              <div>
                <label className="label">{t('reminder.subject')}</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="input"
                  disabled={drafting}
                />
              </div>
              <div>
                <label className="label">{t('reminder.message')}</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="input min-h-[220px] leading-relaxed"
                  disabled={drafting}
                />
                <p className="text-xs text-text-faint mt-1.5">{t('reminder.editableNote')}</p>
              </div>

              <button
                onClick={() => generate(tone)}
                disabled={drafting}
                className="flex items-center gap-1.5 text-[13px] font-medium text-accent-link hover:underline disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${drafting ? 'animate-spin' : ''}`} />
                {drafting ? t('reminder.drafting') : t('reminder.draftAnother')}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-[22px] py-3.5 bg-row-hover border-t border-hairline">
          <p className="text-xs text-text-faint">{t('reminder.neverAutoSends')}</p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn btn-secondary" disabled={sending}>
              {t('reminder.cancel')}
            </button>
            <button
              onClick={handleSend}
              disabled={sending || drafting || !subject.trim() || !body.trim()}
              className="btn btn-primary flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              {sending ? t('reminder.sending') : t('reminder.send')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
