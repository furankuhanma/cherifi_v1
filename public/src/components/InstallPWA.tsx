import React, { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallPWA: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    console.log("🔍 InstallPWA component mounted");

    // Check if already installed
    const isStandalone = window.matchMedia(
      "(display-mode: standalone)",
    ).matches;
    console.log("📱 Is standalone:", isStandalone);

    if (isStandalone) {
      console.log("✅ App is already installed");
      return;
    }

    // Check if dismissed
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    console.log("💾 Dismissed status:", dismissed);

    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissed =
        (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      console.log("📅 Days since dismissed:", daysSinceDismissed);

      if (daysSinceDismissed < 7) {
        console.log("⏸️ Too soon to show again");
        return;
      }
    }

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log("🎉 beforeinstallprompt event fired!");
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setShowInstallButton(true);

      setTimeout(() => {
        console.log("📢 Showing banner");
        setShowBanner(true);
      }, 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for installation
    const handleAppInstalled = () => {
      console.log("✅ PWA was installed");
      setShowInstallButton(false);
      setShowBanner(false);
      setDeferredPrompt(null);
      localStorage.removeItem("pwa-install-dismissed");
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    // Debug: Check event listeners
    console.log("👂 Event listeners registered");
    console.log("🌐 User agent:", navigator.userAgent);
    console.log("📱 Platform:", navigator.platform);

    // Force show for testing (remove this later)
    setTimeout(() => {
      if (!deferredPrompt) {
        console.warn("⚠️ beforeinstallprompt never fired after 5 seconds");
        console.log("🔍 Checking PWA criteria:");
        console.log("  - HTTPS:", window.location.protocol === "https:");
        console.log("  - Service Worker:", "serviceWorker" in navigator);
        console.log(
          "  - Manifest:",
          document.querySelector('link[rel="manifest"]') !== null,
        );
      }
    }, 5000);

    return () => {
      console.log("🧹 Cleaning up event listeners");
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [deferredPrompt]);

  const handleInstallClick = async () => {
    console.log("👆 Install button clicked");

    if (!deferredPrompt) {
      console.error("❌ No deferred prompt available");
      return;
    }

    console.log("📲 Showing install prompt...");
    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    console.log(`✅ User response: ${outcome}`);

    setDeferredPrompt(null);
    setShowInstallButton(false);
    setShowBanner(false);
  };

  const handleDismissBanner = () => {
    console.log("❌ Banner dismissed");
    setShowBanner(false);
    localStorage.setItem("pwa-install-dismissed", new Date().toISOString());
  };

  // Always show button for debugging
  console.log("🎨 Render state:", {
    showInstallButton,
    showBanner,
    hasDeferredPrompt: !!deferredPrompt,
  });

  if (!showInstallButton) {
    console.log("🚫 Not showing install button");
    return null;
  }

  return (
    <>
      {/* Install Banner */}
      {showBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                  <img
                    src="/icons/icon-96x96.png"
                    alt="CheriFI"
                    className="w-10 h-10"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm md:text-base">
                    Install CheriFI App
                  </h3>
                  <p className="text-xs md:text-sm text-white/90 truncate">
                    Get the full experience with offline playback
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleInstallClick}
                  className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-50 transition-colors flex items-center gap-2"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">Install</span>
                </button>
                <button
                  onClick={handleDismissBanner}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Install Button */}
      {!showBanner && (
        <button
          onClick={handleInstallClick}
          className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-40 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 group"
          aria-label="Install App"
        >
          <Download size={20} className="group-hover:animate-bounce" />
          <span className="hidden md:inline font-medium">Install App</span>
        </button>
      )}
    </>
  );
};

export default InstallPWA;
