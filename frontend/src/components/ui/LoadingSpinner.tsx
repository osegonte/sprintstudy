import React from 'react';
import { clsx } from 'clsx';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  className,
  text 
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <div className={clsx('flex items-center justify-center', className)}>
      <div className="flex flex-col items-center space-y-2">
        <div
          className={clsx(
            'animate-spin border-2 border-primary-200 border-t-primary-600 rounded-full',
            sizeClasses[size]
          )}
        />
        {text && (
          <p className={clsx('text-gray-600', textSizeClasses[size])}>
            {text}
          </p>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner;
