import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({ 
  isOpen, onClose, onConfirm, title, message 
}) => {
  if (!isOpen) return null;

  return (
    // The wrapper ensures the modal stays perfectly centered regardless of scroll
    <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4">
      
      {/* 1. Backdrop Overlay - Full screen dark/blur */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-md animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      {/* 2. The Modal - Centered and floating */}
      <div className="relative z-[1002] bg-zinc-900 border border-zinc-800/50 rounded-[2rem] w-full max-w-[280px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 fade-in duration-200">
        
        {/* Content Area */}
        <div className="p-8 pb-6 text-center">
          <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
            <AlertTriangle className="text-red-500" size={28} />
          </div>
          
          <h3 className="text-lg font-bold text-white mb-2 leading-tight">
            {title}
          </h3>
          <p className="text-zinc-400 text-[11px] leading-relaxed px-1">
            {message}
          </p>
        </div>

        {/* Buttons */}
        <div className="p-4 pt-0 flex flex-col gap-2">
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="w-full py-3.5 rounded-2xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 active:scale-95 transition-all shadow-lg shadow-red-500/20"
          >
            Remove
          </button>
          
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl bg-zinc-800 text-zinc-400 text-sm font-bold hover:text-white hover:bg-zinc-700 active:scale-95 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;