interface StickySaveBarProps {
  /** Shown only once the form is dirty — a clean form has nothing to save */
  show: boolean;
  saving: boolean;
  saveLabel: string;
  savingLabel: string;
  message: string;
  discardLabel: string;
  onDiscard: () => void;
}

/**
 * Save bar that slides in at the bottom of the viewport when a form has unsaved
 * changes. Fixed rather than sticky: the main content wrapper in Layout uses
 * `overflow-x-hidden`, which makes `position: sticky` a no-op inside it.
 * Sits above the mobile tab bar, and clears the desktop AI button on the right.
 */
export default function StickySaveBar({
  show,
  saving,
  saveLabel,
  savingLabel,
  message,
  discardLabel,
  onDiscard,
}: StickySaveBarProps) {
  return (
    <div
      aria-hidden={!show}
      className={`fixed inset-x-0 z-30 lg:pl-[216px] bottom-[calc(var(--mobile-nav-height)+env(safe-area-inset-bottom))] lg:bottom-0 transition-[opacity,transform] duration-150 ${
        show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
    >
      <div className="bg-surface/95 backdrop-blur-sm border-t border-border">
        <div className="flex items-center gap-3 px-[18px] py-3 lg:px-7 lg:pr-[88px]">
          <p className="hidden sm:block text-[13px] text-text-muted">{message}</p>
          <div className="flex items-center gap-2 w-full sm:w-auto sm:ml-auto">
            <button
              type="button"
              onClick={onDiscard}
              disabled={saving || !show}
              className="btn btn-secondary flex-1 sm:flex-none"
            >
              {discardLabel}
            </button>
            <button type="submit" disabled={saving || !show} className="btn btn-primary flex-1 sm:flex-none">
              {saving ? savingLabel : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
