import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Music, Eye, EyeOff, CheckCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const AuthScreen: React.FC = () => {
  const navigate = useNavigate();
  const { login, register, isAuthenticated, error, clearError, isLoading } =
    useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");
  const [success, setSuccess] = useState("");

  const isLogin = mode === "login";

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    setLocalError("");
    setSuccess("");
    clearError();
  }, [mode, clearError]);

  const validateForm = (): boolean => {
    setLocalError("");
    if (!username.trim()) {
      setLocalError("Username is required");
      return false;
    }
    if (username.length < 3) {
      setLocalError("Username must be at least 3 characters");
      return false;
    }
    if (!password) {
      setLocalError("Password is required");
      return false;
    }
    if (password.length < 6) {
      setLocalError("Password must be at least 6 characters");
      return false;
    }
    if (!isLogin && password !== confirmPassword) {
      setLocalError("Passwords do not match");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password);
        setSuccess("Account created successfully! Welcome to CheriFI.");
      }
    } catch (err) {
      console.error("Auth error:", err);
    }
  };

  const switchMode = () => {
    setMode(isLogin ? "register" : "login");
    setPassword("");
    setConfirmPassword("");
    setLocalError("");
    setSuccess("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleSubmit(e as any);
    }
  };

  const displayError = localError || error;

  return (
    <div className="p-8 mt-10 min-h-screen bg-black flex flex-col items-center justify-start py-10 px-4">
      {/* Spotify-style Header Logo */}
      <div className="flex items-center gap-2 mb-12">
        <div className="bg-blue-400 p-2 rounded-full">
          <Music className="w-8 h-8 text-black" />
        </div>
        <span className="text-white text-3xl font-extrabold tracking-tight">
          CheriFI
        </span>
      </div>

      <div className="w-full max-w-[450px] bg-gradient-to-b from-[#121212] to-black p-10 md:p-14 rounded-xl shadow-2xl border border-zinc-800/30">
        <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-8 text-center">
          {isLogin ? "Log in to CheriFI" : "Sign up for free"}
        </h2>

        {/* Global Feedback Messages */}
        <div className="space-y-4 mb-8">
          {success && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              <p className="text-sm text-emerald-200">{success}</p>
            </div>
          )}
          {displayError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-200">{displayError}</p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username Input */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-white">
              Username or email address
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-[#121212] border border-zinc-500 rounded px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white transition-all hover:border-zinc-300"
              placeholder="Username or email address"
              disabled={isLoading}
            />
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-white">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-[#121212] border border-zinc-500 rounded px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white transition-all hover:border-zinc-300 pr-12"
                placeholder="Password"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Register only) */}
          {!isLogin && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-bold text-white">
                Confirm your password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-[#121212] border border-zinc-500 rounded px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white transition-all hover:border-zinc-300"
                placeholder="Confirm your password"
                disabled={isLoading}
              />
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-500 hover:bg-[#1e2ad7] hover:scale-[1.02] active:scale-[0.98] text-black font-bold py-3.5 rounded-full transition-all disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed uppercase tracking-widest text-sm"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                  Processing
                </div>
              ) : isLogin ? (
                "Log In"
              ) : (
                "Sign Up"
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 border-t border-zinc-800 pt-8 text-center">
          <p className="text-zinc-400 font-medium">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={switchMode}
              disabled={isLoading}
              className="text-white font-bold hover:underline hover:text-blue-400 transition-colors"
            >
              {isLogin ? "Sign up for CheriFI" : "Log in here"}
            </button>
          </p>
        </div>
      </div>

      <div className="mt-12 text-zinc-500 text-xs text-center max-w-md">
        This site is protected by reCAPTCHA and the Google
        <a href="#" className="underline mx-1 hover:text-white">
          Privacy Policy
        </a>{" "}
        and
        <a href="#" className="underline mx-1 hover:text-white">
          Terms of Service
        </a>{" "}
        apply.
      </div>
    </div>
  );
};

export default AuthScreen;
