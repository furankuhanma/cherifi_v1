// ============================================
// LoadingSpinner.tsx
// ============================================

import React from 'react';
import { Loader } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  message,
  fullScreen = false,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const borderClasses = {
    sm: 'border-2',
    md: 'border-3',
    lg: 'border-4',
    xl: 'border-4'
  };

  const spinner = (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`}>
      <div 
        className={`${sizeClasses[size]} ${borderClasses[size]} border- border-t-transparent rounded-full animate-spin`}
      />
      {message && (
        <p className="text-zinc-400 text-sm animate-pulse">{message}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
        {spinner}
      </div>
    );
  }

  return spinner;
};

// ============================================
// LoadingSkeleton.tsx
// ============================================

interface LoadingSkeletonProps {
  type?: 'card' | 'list' | 'text' | 'track';
  count?: number;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ 
  type = 'card', 
  count = 1,
  className = ''
}) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return (
          <div className={`bg-zinc-900 bg-opacity-40 p-4 rounded-lg ${className}`}>
            <div className="aspect-square bg-zinc-800 rounded-md mb-4 animate-pulse" />
            <div className="h-4 bg-zinc-800 rounded mb-2 animate-pulse" />
            <div className="h-3 bg-zinc-800 rounded w-2/3 animate-pulse" />
          </div>
        );
      
      case 'list':
        return (
          <div className={`flex items-center gap-4 p-3 ${className}`}>
            <div className="w-12 h-12 bg-zinc-800 rounded animate-pulse" />
            <div className="flex-1">
              <div className="h-4 bg-zinc-800 rounded mb-2 animate-pulse" />
              <div className="h-3 bg-zinc-800 rounded w-1/2 animate-pulse" />
            </div>
          </div>
        );
      
      case 'track':
        return (
          <div className={`grid grid-cols-[auto_1fr_40px] md:grid-cols-[16px_1fr_1fr_40px] items-center gap-4 px-4 py-3 ${className}`}>
            <div className="hidden md:block w-4 h-4 bg-zinc-800 rounded animate-pulse" />
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-zinc-800 rounded md:hidden animate-pulse" />
              <div className="flex-1">
                <div className="h-4 bg-zinc-800 rounded mb-2 animate-pulse" />
                <div className="h-3 bg-zinc-800 rounded w-2/3 animate-pulse" />
              </div>
            </div>
            <div className="hidden md:block h-3 bg-zinc-800 rounded w-24 animate-pulse" />
            <div className="h-3 bg-zinc-800 rounded w-10 animate-pulse" />
          </div>
        );
      
      case 'text':
        return (
          <div className={`space-y-2 ${className}`}>
            <div className="h-4 bg-zinc-800 rounded animate-pulse" />
            <div className="h-4 bg-zinc-800 rounded w-5/6 animate-pulse" />
            <div className="h-4 bg-zinc-800 rounded w-4/6 animate-pulse" />
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <React.Fragment key={i}>
          {renderSkeleton()}
        </React.Fragment>
      ))}
    </>
  );
};

// ============================================
// ErrorMessage.tsx
// ============================================

import { AlertCircle, RefreshCw, XCircle, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryText?: string;
  showHomeButton?: boolean;
  type?: 'error' | 'warning' | 'info';
  fullScreen?: boolean;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ 
  title = 'Something went wrong',
  message,
  onRetry,
  retryText = 'Try Again',
  showHomeButton = false,
  type = 'error',
  fullScreen = false,
  className = ''
}) => {
  const navigate = useNavigate();

  const typeStyles = {
    error: {
      bg: 'bg-red-900/20',
      border: 'border-red-500',
      text: 'text-red-400',
      icon: <XCircle size={48} className="text-red-400" />
    },
    warning: {
      bg: 'bg-yellow-900/20',
      border: 'border-yellow-500',
      text: 'text-yellow-400',
      icon: <AlertCircle size={48} className="text-yellow-400" />
    },
    info: {
      bg: 'bg-blue-900/20',
      border: 'border-blue-500',
      text: 'text-blue-400',
      icon: <AlertCircle size={48} className="text-blue-400" />
    }
  };

  const style = typeStyles[type];

  const content = (
    <div className={`${style.bg} border ${style.border} rounded-lg p-6 max-w-md text-center ${className}`}>
      <div className="mb-4 flex justify-center">
        {style.icon}
      </div>
      <h3 className={`text-lg font-bold mb-2 ${style.text}`}>{title}</h3>
      <p className={`text-sm mb-6 ${style.text}`}>{message}</p>
      
      <div className="flex gap-3 justify-center flex-wrap">
        {onRetry && (
          <button 
            onClick={onRetry}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-black rounded-full font-bold hover:scale-105 transition"
          >
            <RefreshCw size={18} />
            {retryText}
          </button>
        )}
        
        {showHomeButton && (
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-full font-bold transition"
          >
            <Home size={18} />
            Go Home
          </button>
        )}
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] animate-in fade-in">
        {content}
      </div>
    );
  }

  return content;
};

// ============================================
// Toast.tsx (Notification Component)
// ============================================

import { CheckCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose?: () => void;
}

export const Toast: React.FC<ToastProps> = ({ 
  message, 
  type = 'info',
  duration = 3000,
  onClose 
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      if (onClose) {
        setTimeout(onClose, 300); // Wait for animation
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const typeStyles = {
    success: {
      bg: 'bg-blue-500',
      text: 'text-black',
      icon: <CheckCircle size={20} />
    },
    error: {
      bg: 'bg-red-500',
      text: 'text-white',
      icon: <XCircle size={20} />
    },
    info: {
      bg: 'bg-zinc-700',
      text: 'text-white',
      icon: <AlertCircle size={20} />
    }
  };

  const style = typeStyles[type];

  if (!isVisible) return null;

  return (
    <div className={`fixed bottom-24 md:bottom-28 left-1/2 transform -translate-x-1/2 z-50 ${isVisible ? 'animate-in slide-in-from-bottom-5 fade-in' : 'animate-out slide-out-to-bottom-5 fade-out'}`}>
      <div className={`${style.bg} ${style.text} px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 min-w-[200px] max-w-md`}>
        {style.icon}
        <span className="font-medium text-sm">{message}</span>
        <button 
          onClick={() => {
            setIsVisible(false);
            if (onClose) setTimeout(onClose, 300);
          }}
          className="ml-2 hover:opacity-70 transition"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

// ============================================
// EmptyState.tsx
// ============================================

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-20 text-center space-y-4 ${className}`}>
      {icon && (
        <div className="bg-zinc-800 p-8 rounded-full mb-2">
          {icon}
        </div>
      )}
      <div className="max-w-xs">
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-zinc-400 text-sm">{description}</p>
      </div>
      {actionLabel && onAction && (
        <button 
          onClick={onAction}
          className="bg-blue-500 text-black px-8 py-3 rounded-full font-bold hover:scale-105 transition mt-4"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};