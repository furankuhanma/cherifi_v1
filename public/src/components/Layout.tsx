import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, Library, Plus, Heart, Music2, PlusCircle, Send, User, Download } from 'lucide-react';
import { useDownloads } from '../context/DownloadContext';
import Player from './Player';
import DownloadProgressToast from './DownloadProgressToast';
import CreateModal from './CreateModal';
import UserProfileMenu from './UserProfile';

const Sidebar = () => {
  const navigate = useNavigate();
  const { downloadQueue } = useDownloads();

  // Count active downloads
  const activeDownloads = downloadQueue.filter(d => d.status === 'downloading').length;

  return (
    <aside className="hidden md:flex flex-col w-64 bg-black p-6 gap-8 h-screen sticky top-0 border-r border-zinc-800">
      <div className="flex items-center gap-2 text-white text-2xl font-bold">
        <Music2 className="text-blue-500" size={32} />
        <span>CheriFI</span>
      </div>

      <nav className="flex flex-col gap-4 text-zinc-400 font-medium">
        <NavLink
          to="/"
          className={({ isActive }) => `flex items-center gap-4 hover:text-white transition ${isActive ? 'text-white' : ''}`}
        >
          <Home size={24} /> Home
        </NavLink>
        <NavLink
          to="/search"
          className={({ isActive }) => `flex items-center gap-4 hover:text-white transition ${isActive ? 'text-white' : ''}`}
        >
          <Search size={24} /> Search
        </NavLink>
        <NavLink
          to="/library"
          className={({ isActive }) => `flex items-center gap-4 hover:text-white transition ${isActive ? 'text-white' : ''}`}
        >
          <Library size={24} /> Your Library
        </NavLink>
        <NavLink
          to="/offline"
          className={({ isActive }) => `flex items-center gap-4 hover:text-white transition relative ${isActive ? 'text-white' : ''}`}
        >
          <div className="relative">
            <Download size={24} />
            {activeDownloads > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                {activeDownloads}
              </span>
            )}
          </div>
          Offline
        </NavLink>
      </nav>

      <div className="flex flex-col gap-4 mt-4">
        <button className="flex items-center gap-4 text-zinc-400 hover:text-white transition font-medium">
          <div className="bg-zinc-400 text-black rounded-sm p-1">
            <Plus size={16} />
          </div>
          Create Playlist
        </button>
        <button className="flex items-center gap-4 text-zinc-400 hover:text-white transition font-medium">
          <div className="bg-gradient-to-br from-indigo-700 to-blue-300 rounded-sm p-1">
            <Heart size={16} className="text-white" />
          </div>
          Liked Songs
        </button>
      </div>

      <div className="mt-auto border-t border-zinc-800 pt-4">
        <p className="text-xs text-zinc-500 hover:underline cursor-pointer">Cookies</p>
        <p className="text-xs text-zinc-500 hover:underline cursor-pointer mt-2">Privacy Policy</p>
      </div>
    </aside>
  );
};

const BottomNav = ({ onCreateOpen }: { onCreateOpen: () => void }) => {
  const { downloadQueue } = useDownloads();

  // Count active downloads
  const activeDownloads = downloadQueue.filter(d => d.status === 'downloading').length;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 bg-opacity-95 backdrop-blur-md border-t border-zinc-800 flex justify-around py-3 z-50">
      <NavLink to="/" className={({ isActive }) => `flex flex-col items-center gap-1 text-[10px] ${isActive ? 'text-white' : 'text-zinc-400'}`}>
        <Home size={24} /> <span>Home</span>
      </NavLink>
      <NavLink to="/search" className={({ isActive }) => `flex flex-col items-center gap-1 text-[10px] ${isActive ? 'text-white' : 'text-zinc-400'}`}>
        <Search size={24} /> <span>Search</span>
      </NavLink>

      <button
        onClick={onCreateOpen}
        className="flex flex-col items-center gap-1 text-[10px] text-zinc-400 hover:text-white transition"
      >
        <PlusCircle size={24} className="text-white/60" /> <span>Create</span>
      </button>

      <NavLink to="/library" className={({ isActive }) => `flex flex-col items-center gap-1 text-[10px] ${isActive ? 'text-white' : 'text-zinc-400'}`}>
        <Library size={24} /> <span>Library</span>
      </NavLink>
      <NavLink to="/offline" className={({ isActive }) => `flex flex-col items-center gap-1 text-[10px] relative ${isActive ? 'text-white' : 'text-zinc-400'}`}>
        <div className="relative">
          <Download size={24} />
          {activeDownloads > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
              {activeDownloads}
            </span>
          )}
        </div>
        <span>Offline</span>
      </NavLink>
    </nav>
  );
};

const Layout: React.FC = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const navigate = useNavigate();
  
  // Use location to determine current path
  const location = useLocation();

  // Logic to hide top bar on specific routes
  const hideOnPaths = ['/search', '/library', '/offline'];
  const shouldHideTopBar = hideOnPaths.includes(location.pathname);

  return (
    <div className="mt-3 flex flex-col md:flex-row min-h-screen bg-zinc-950 text-white relative">
      <Sidebar />

      <main className="flex-1 overflow-y-auto pb-32 md:pb-36">

        {/* Top Bar with Chat Icon and Profile - Conditionall rendered */}
        {!shouldHideTopBar && (
          <div className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800 px-4 md:px-8 py-4 flex items-center justify-between">
            {/* Profile Icon Button - Mobile Only */}
            <button
              onClick={() => setIsProfileOpen(true)}
              className="md:hidden relative p-2 hover:bg-zinc-800 rounded-full transition group w-10 h-10 rounded-full bg-zinc-900"
              title="Profile"
            >
              <User size={24} className="text-zinc-400 group-hover:text-white" />
            </button>
            <h1 className="text-2xl font-bold">CheriFI</h1>

            <div className="flex items-center gap-2">
              {/* Chat Icon Button */}
              <button
                onClick={() => navigate('/ai-chat')}
                className="relative p-2 hover:bg-zinc-800 rounded-full transition group"
                title="AI Chat"
              >
                <Send size={20} className="text-zinc-400 group-hover:text-white" />
              </button>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>

      <Player />
      <DownloadProgressToast />
      <BottomNav onCreateOpen={() => setIsCreateOpen(true)} />
      <CreateModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <UserProfileMenu
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </div>
  );
};

export default Layout;