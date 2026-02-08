import React, { useEffect, useState } from "react";
import { useDownloads } from "../context/DownloadContext";
import { Download, CheckCircle, XCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion"; // Added Framer Motion

const DownloadProgressToast: React.FC = () => {
  const { downloadQueue } = useDownloads();
  const [visibleDownloads, setVisibleDownloads] = useState<string[]>([]);

  // Auto-hide completed/failed downloads after 3 seconds
  useEffect(() => {
    downloadQueue.forEach((download) => {
      if (download.status === "completed" || download.status === "failed") {
        const timer = setTimeout(() => {
          setVisibleDownloads((prev) =>
            prev.filter((id) => id !== download.trackId),
          );
        }, 3000);
        return () => clearTimeout(timer);
      } else {
        setVisibleDownloads((prev) => {
          if (!prev.includes(download.trackId)) {
            return [...prev, download.trackId];
          }
          return prev;
        });
      }
    });
  }, [downloadQueue]);

  const handleDismiss = (id: string) => {
    setVisibleDownloads((prev) => prev.filter((trackId) => trackId !== id));
  };

  const displayedDownloads = downloadQueue.filter((d) =>
    visibleDownloads.includes(d.trackId),
  );

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
              dragElastic={0.1} // Add this for smoother drag feel
              onDragEnd={(_, info) => {
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

                    {/* Close button */}
                    {(isFailed || isCompleted) && (
                      <button
                        onClick={() => handleDismiss(download.trackId)}
                        className="flex-shrink-0 p-1 hover:bg-gray-800 rounded transition-colors"
                      >
                        <X size={14} className="text-gray-400" />
                      </button>
                    )}
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
