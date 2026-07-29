'use client';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export default function LoadingState({
  message = 'Carregando dados...',
  className = '',
}: LoadingStateProps) {
  return (
    <div className={`p-12 flex flex-col items-center justify-center text-center ${className}`}>
      <div className="relative flex items-center justify-center mb-3">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-600/20 border-t-blue-600 dark:border-blue-400/20 dark:border-t-blue-400"></div>
      </div>
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400 animate-pulse">{message}</p>
    </div>
  );
}
