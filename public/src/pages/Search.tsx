import React, { useState, useEffect } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { CATEGORIES } from '../constants';
import { Track } from '../types/types';
import { searchAPI } from '../services/api';
import { usePlayer } from '../context/PlayerContext';
import { useLikes } from '../context/LikeContext';
import { useDownloads } from '../context/DownloadContext';
import TrackOptionsMenu from '../components/TrackOptionsMenu';
import AddToPlaylistModal from '../components/AddToPlayListModal';

const Search: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Modal state
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  const { playTrack, setPlaylist } = usePlayer();
  const { isLiked, toggleLike } = useLikes();
  const { isDownloaded, downloadTrack } = useDownloads();

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  /**
   * Handle search request
   */
  const handleSearch = async (query: string) => {
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      console.log(`🔍 Searching for: "${query}"`);
      const results = await searchAPI.search(query, 20);
      setSearchResults(results);
      console.log(`✅ Found ${results.length} results`);
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || 'Search failed';
      console.error('❌ Search error:', errorMsg);
      setSearchError(errorMsg);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Handle track click
   */
  const handleTrackClick = (track: Track) => {
    setPlaylist(searchResults);
    playTrack(track);
  };

  /**
   * Handle add to playlist
   */
  const handleAddToPlaylist = (track: Track) => {
    setSelectedTrack(track);
    setIsPlaylistModalOpen(true);
  };

  /**
   * Handle like toggle
   */
  const handleToggleLike = (track: Track) => {
    toggleLike(track);
  };

  /**
   * Handle download for offline
   */
  const handleDownload = async (track: Track) => {
    try {
      await downloadTrack(track);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  /**
   * Handle download music file
   */
  const handleDownloadMusic = async (track: Track) => {
    try {
      console.log(`🎵 Downloading music file: ${track.title}`);

      // Check if track has videoId
      if (!track.videoId) {
        console.error('❌ No videoId available for download');
        return;
      }

      // Fetch stream URL from API
      const response = await fetch(`/api/stream/${track.videoId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch stream URL');
      }

      const streamData = await response.json();

      // Create a temporary link element
      const link = document.createElement('a');
      link.href = streamData.url;
      link.download = `${track.artist} - ${track.title}.mp3`;
      link.target = '_blank';

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('✅ Music download started');
    } catch (error) {
      console.error('❌ Music download failed:', error);
    }
  };

  const categories = ["Songs", "Playlists", "Artists", "Podcasts", "Albums", "Genres & Moods"]
  /**
   * Handle category click
   */
  const handleCategoryClick = (categoryName: string) => {
    setSearchQuery(categoryName.toLowerCase());
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h1 className="text-2xl md:text-3xl font-bold">Search</h1>

      {/* Search Input */}
      <div className="relative sticky top-0 md:static z-30">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <SearchIcon className="text-zinc-500" size={20} />
        </div>
        <input
          type="text"
          placeholder="What do you want to listen to?"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white text-black py-3 pl-10 pr-4 rounded-full font-medium focus:outline-none placeholder-zinc-500"
        />


      </div>

      {/* Search Results */}
      {hasSearched && (
        <div>
          {isSearching && (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-500  border-t-transparent rounded-full animate-spin" />
                <p className="text-zinc-400">Searching...</p>
              </div>
            </div>
          )}

          {searchError && !isSearching && (
            <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 text-center">
              <p className="text-red-400">❌ {searchError}</p>
              <button
                onClick={() => handleSearch(searchQuery)}
                className="mt-2 text-sm text-blue-500  hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {!isSearching && !searchError && searchResults.length === 0 && (
            <div className="text-center py-20">
              <p className="text-zinc-400 text-lg">No results found for "{searchQuery}"</p>
              <p className="text-zinc-500 text-sm mt-2">Try different keywords</p>
            </div>
          )}

          {!isSearching && searchResults.length > 0 && (
            <div>
              <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar"> {/* Parent container wraps the map */}
                {categories.map((c) => (
                  <div key={c} className="flex-shrink-0 p-2 px-4 bg-zinc-900 rounded-2xl">
                    <p className="text-sm font-medium text-white">{c}</p>
                  </div>
                ))}
              </div>

              <div>
                {searchResults.map((track) => (
                  <div
                    key={track.id}
                    className="mt-3 group relative z-0 flex items-center gap-3 rounded-lg p-2 transition hover:bg-zinc-800 hover:z-50"
                  >
                    {/* Track Image - Far Left */}
                    <div
                      onClick={() => handleTrackClick(track)}
                      className="relative h-12 w-12 flex-shrink-0 cursor-pointer overflow-hidden rounded-md shadow-lg"
                    >
                      <img
                        src={track.coverUrl}
                        alt={track.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition">
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Track Info - Center */}
                    <div
                      onClick={() => handleTrackClick(track)}
                      className="min-w-0 flex-1 cursor-pointer"
                    >
                      <h3 className={`truncate text-sm font-bold mb-0.5 ${track.id === 'currently-playing-id' ? 'text-blue-500 ' : 'text-white'}`}>
                        {track.title}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-zinc-400">
                        <span>Song</span>
                        <span>•</span>
                        <span className="truncate">{track.artist}</span>
                        {track.albumName && (
                          <>
                            <span>•</span>
                            <span className="truncate">{track.albumName}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions - Far Right */}
                    <div
                      className={`z-10 transition-opacity duration-200 ${isPlaylistModalOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
                        }`}
                    >
                      <TrackOptionsMenu
                        track={track}
                        onAddToPlaylist={handleAddToPlaylist}
                        onToggleLike={handleToggleLike}
                        onDownload={handleDownload}
                        onDownloadMusic={handleDownloadMusic}
                        isLiked={isLiked(track.id)}
                        isDownloaded={isDownloaded(track.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Browse Categories */}
      {!hasSearched && (
        <>
          <h2 className="text-xl font-bold mt-8 mb-4">Browse all</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {CATEGORIES.map((category) => (
              <div
                key={category.id}
                onClick={() => handleCategoryClick(category.name)}
                className={`${category.color} aspect-[3/2] md:aspect-square p-4 rounded-lg relative overflow-hidden hover:scale-[1.02] transition cursor-pointer group`}
              >
                <span className="text-xl font-bold">{category.name}</span>
                <img
                  src={`https://picsum.photos/seed/${category.id}/200/200`}
                  alt=""
                  className="absolute -bottom-4 -right-4 w-24 h-24 md:w-32 md:h-32 rotate-[25deg] shadow-xl group-hover:rotate-[15deg] transition duration-300"
                />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add to Playlist Modal */}
      <AddToPlaylistModal
        isOpen={isPlaylistModalOpen}
        onClose={() => {
          setIsPlaylistModalOpen(false);
          setSelectedTrack(null);
        }}
        track={selectedTrack}
      />
    </div>
  );
};

export default Search;