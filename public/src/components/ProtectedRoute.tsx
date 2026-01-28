
import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      console.warn('⚠️ Access denied:', location.pathname);
    }
  }, [isAuthenticated, isLoading, location]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-6">
        <div className="relative">
            {/* Pulsing Spotify-like icon loader */}
            <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center animate-pulse shadow-[0_0_40px_-10px_rgba(29,185,84,0.6)]">
                <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
            </div>
        </div>
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs animate-bounce">
            Connecting
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
