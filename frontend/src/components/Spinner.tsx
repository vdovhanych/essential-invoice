interface SpinnerProps {
  className?: string;
}

export function Spinner({ className = 'h-12 w-12' }: SpinnerProps) {
  return <div className={`animate-spin rounded-full border-b-2 border-accent ${className}`}></div>;
}

/** Full-screen centered spinner used on auth/route guards. */
export function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <Spinner />
    </div>
  );
}

/** Centered spinner for in-layout page loading states. */
export function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner />
    </div>
  );
}
