import React, { useState } from 'react';
import { User, Settings, LogOut, ChevronRight, Bell, Shield, HelpCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface UserProfileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const UserProfileMenu: React.FC<UserProfileMenuProps> = ({ 
  isOpen, 
  onClose
}) => {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    
    try {
      await logout();
      onClose();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };



  // Default values if user is not authenticated
  const username = user?.username || 'Guest User';
  const userAvatar = user?.avatar;

  return (
   <div className="fixed inset-0 z-[100] md:hidden pointer-events-none">
      {/* Overlay */}
  <div
    className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300
      ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0'}`}
    onClick={onClose}
  />
      
      {/* Menu Panel - Slide from right */}
<div
  className={`absolute left-0 top-0 bottom-0 w-[85%] max-w-sm bg-zinc-900 overflow-y-auto
              transform transition-transform duration-500 ease-in-out
              ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
>

        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Account</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-full transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* User Profile Section */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center gap-4 mb-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-700 flex items-center justify-center text-black font-bold text-2xl overflow-hidden">
              {userAvatar ? (
                <img src={userAvatar} alt={username} className="w-full h-full object-cover" />
              ) : (
                <span>{username.charAt(0).toUpperCase()}</span>
              )}
            </div>
            
            {/* User Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white text-lg truncate">{username}</h3>
            </div>
          </div>

          {/* View Profile Button */}
          <button className="w-full py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 rounded-full font-medium text-sm transition flex items-center justify-center gap-2">
            <User size={18} />
            View Profile
          </button>
        </div>

        {/* Menu Items */}
        <div className="py-2">
          {/* Account Settings */}
          <button className="w-full px-6 py-4 hover:bg-zinc-800 transition flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <Settings size={20} className="text-zinc-400 group-hover:text-white transition" />
              <span className="font-medium">Account Settings</span>
            </div>
            <ChevronRight size={20} className="text-zinc-500" />
          </button>

          {/* Notifications */}
          <button className="w-full px-6 py-4 hover:bg-zinc-800 transition flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <Bell size={20} className="text-zinc-400 group-hover:text-white transition" />
              <span className="font-medium">Notifications</span>
            </div>
            <ChevronRight size={20} className="text-zinc-500" />
          </button>

          {/* Privacy & Security */}
          <button className="w-full px-6 py-4 hover:bg-zinc-800 transition flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <Shield size={20} className="text-zinc-400 group-hover:text-white transition" />
              <span className="font-medium">Privacy & Security</span>
            </div>
            <ChevronRight size={20} className="text-zinc-500" />
          </button>

          {/* Help & Support */}
          <button className="w-full px-6 py-4 hover:bg-zinc-800 transition flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <HelpCircle size={20} className="text-zinc-400 group-hover:text-white transition" />
              <span className="font-medium">Help & Support</span>
            </div>
            <ChevronRight size={20} className="text-zinc-500" />
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-800 my-2" />

        {/* Logout Button */}
        <div className="p-4">
          <button 
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full py-3 px-4 bg-red-900/20 hover:bg-red-900/30 border border-red-500/50 rounded-full font-bold text-red-400 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoggingOut ? (
              <>
                <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                Logging out...
              </>
            ) : (
              <>
                <LogOut size={18} />
                Log Out
              </>
            )}
          </button>
        </div>

        {/* Footer Info */}
        <div className="p-6 pt-2 text-center">
          <p className="text-xs text-zinc-500 mb-2">CheriFI v1.0.0</p>
          <div className="flex items-center justify-center gap-4 text-xs text-zinc-500">
            <button className="hover:text-white transition">Privacy Policy</button>
            <span>•</span>
            <button className="hover:text-white transition">Terms of Service</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileMenu;