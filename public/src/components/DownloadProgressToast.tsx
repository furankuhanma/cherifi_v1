import React, { useEffect, useState, useRef } from "react";
import { useDownloads } from "../context/DownloadContext";
import { Download, CheckCircle, XCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DownloadProgressToast: React.FC = () => {
  const { downloadQueue } = useDownloads();
  const [dismissedDownloads, setDismissedDownloads] = useState<Set<string>>(
    new Set(),
  );
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Auto-hide downloads after specific durations
  useEffect(() => {
    downloadQueue.forEach((download) => {
      const trackId = download.trackId;

      // Skip if already dismissed
      if (dismissedDownloads.has(trackId)) {
        return;
      }

      // Clear existing timer for this track
      const existingTimer = timersRef.current.get(trackId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set auto-hide timer based on status
      let hideDelay = 0;

      if (download.status === "completed") {
        hideDelay = 3000; // 3 seconds for completed
      } else if (download.status === "failed") {
        hideDelay = 5000; // 5 seconds for failed (longer to read error)
      } else if (download.status === "downloading") {
        // Don't auto-hide while downloading
        return;
      }

      if (hideDelay > 0) {
        const timer = setTimeout(() => {
          handleDismiss(trackId);
        }, hideDelay);

        timersRef.current.set(trackId, timer);
      }
    });

    // Cleanup timers on unmount
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [downloadQueue, dismissedDownloads]);

  const handleDismiss = (trackId: string) => {
    // Add to dismissed set so it doesn't reappear
    setDismissedDownloads((prev) => new Set(prev).add(trackId));

    // Clear timer if exists
    const timer = timersRef.current.get(trackId);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(trackId);
    }
  };

  // Filter out dismissed downloads
  const displayedDownloads = downloadQueue.filter(
    (d) => !dismissedDownloads.has(d.trackId),
  );

  // Cleanup dismissed downloads that are no longer in queue
  useEffect(() => {
    const currentTrackIds = new Set(downloadQueue.map((d) => d.trackId));
    setDismissedDownloads((prev) => {
      const updated = new Set(prev);
      let hasChanges = false;

      prev.forEach((trackId) => {
        if (!currentTrackIds.has(trackId)) {
          updated.delete(trackId);
          hasChanges = true;
        }
      });

      return hasChanges ? updated : prev;
    });
  }, [downloadQueue]);

  if (displayedDownloads.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-24 md:bottom-28 left-1/2 -translate-x-1/2 z-40 space-y-2 max-w-[90%] sm:max-w-sm w-full px-4 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {displayedDownloads.map((download) => {
          const isCompleted = download.status === "completed";
          const isFailed = download.status === "failed";
          const isDownloading = download.status === "downloading";

          return (
            <motion.div
              key={download.trackId}
              layout
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, x: 200, transition: { duration: 0.2 } }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.1}
              onDragEnd={(_, info) => {
                // Swipe to dismiss (100px threshold)
                if (Math.abs(info.offset.x) > 100) {
                  handleDismiss(download.trackId);
                }
              }}
              className={`pointer-events-auto cursor-grab active:cursor-grabbing bg-gray-900 border rounded-lg shadow-xl p-4 backdrop-blur-md transition-colors duration-300 ${
                isCompleted
                  ? "border-blue-400"
                  : isFailed
                    ? "border-red-500"
                    : "border-gray-700"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className={`flex-shrink-0 rounded-full p-2 ${
                    isCompleted
                      ? "bg-blue-500/20"
                      : isFailed
                        ? "bg-red-500/20"
                        : "bg-blue-500/20"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle size={20} className="text-blue-500" />
                  ) : isFailed ? (
                    <XCircle size={20} className="text-red-500" />
                  ) : (
                    <Download
                      size={20}
                      className="text-blue-400 animate-bounce"
                    />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">
                        {download.trackTitle || "Unknown Track"}
                      </p>
                      <p className="text-gray-400 text-xs truncate">
                        {download.trackArtist || "Unknown Artist"}
                      </p>
                    </div>

                    {/* Close button - show for all statuses */}
                    <button
                      onClick={() => handleDismiss(download.trackId)}
                      className="flex-shrink-0 p-1 hover:bg-gray-800 rounded transition-colors"
                    >
                      <X size={14} className="text-gray-400" />
                    </button>
                  </div>

                  {/* Progress Bar and Status */}
                  {isDownloading && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-gray-400">Downloading...</p>
                        <p className="text-xs text-gray-400">
                          {download.progress}%
                        </p>
                      </div>
                      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-[#1DB954] transition-all duration-300 ease-out"
                          style={{ width: `${download.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {isFailed && download.error && (
                    <p className="text-xs text-red-400 mt-1">
                      {download.error}
                    </p>
                  )}

                  {isCompleted && (
                    <p className="text-xs text-blue-500 mt-1">
                      Available offline now
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Summary Footer */}
      <AnimatePresence>
        {displayedDownloads.length > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-gray-900/80 border border-gray-700 rounded-lg p-2 text-center backdrop-blur-md"
          >
            <p className="text-xs text-gray-400">
              {
                displayedDownloads.filter((d) => d.status === "downloading")
                  .length
              }{" "}
              downloading
              {displayedDownloads.filter((d) => d.status === "completed")
                .length > 0 &&
                `, ${displayedDownloads.filter((d) => d.status === "completed").length} completed`}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DownloadProgressToast;
