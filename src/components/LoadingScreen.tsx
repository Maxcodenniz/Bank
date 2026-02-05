import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface LoadingScreenProps {
  onLoadingComplete: () => void;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onLoadingComplete }) => {
  const [progress, setProgress] = useState(0);
  const [showLogo, setShowLogo] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [audioPlayed, setAudioPlayed] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [audioError, setAudioError] = useState(false);

  useEffect(() => {
    const logoTimer = setTimeout(() => {
      setShowLogo(true);
    }, 500);

    // Optimized for 2-second total display time
    // Progress: ~1.3s, delay: 0.2s, fade: 0.5s = ~2s total
    const progressTimer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressTimer);
          return 100;
        }
        return prev + 7.5; // Adjusted for ~1.3s completion (100/7.5 * 80ms ≈ 1.07s)
      });
    }, 80);

    if (!audioPlayed && audioEnabled) {
      playCustomJingle();
      setAudioPlayed(true);
    }

    return () => {
      clearTimeout(logoTimer);
      clearInterval(progressTimer);
    };
  }, [audioPlayed, audioEnabled]);

  useEffect(() => {
    if (progress >= 100) {
      const completeTimer = setTimeout(() => {
        setFadeOut(true);
        setTimeout(() => {
          onLoadingComplete();
        }, 500); // Reduced fade out duration from 900ms to 500ms
      }, 200); // Reduced delay from 600ms to 200ms for faster completion

      return () => clearTimeout(completeTimer);
    }
  }, [progress, onLoadingComplete]);

  const playCustomJingle = () => {
    try {
      const audio = new Audio('/jingle.mp3');
      audio.volume = 0.4;
      audio.preload = 'auto';

      audio.addEventListener('loadeddata', () => {
        audio.volume = 0;
        audio.play().then(() => {
          const fadeIn = setInterval(() => {
            if (audio.volume < 0.4) {
              audio.volume = Math.min(audio.volume + 0.04, 0.4);
            } else {
              clearInterval(fadeIn);
            }
          }, 60);
        }).catch(error => {
          console.log('Audio playback failed:', error);
          setAudioError(true);
        });
      });

      audio.addEventListener('error', () => {
        setAudioError(true);
      });

      if (audio.readyState >= 2) {
        audio.volume = 0.4;
        audio.play().catch(() => setAudioError(true));
      }
    } catch (error) {
      setAudioError(true);
    }
  };

  const toggleAudio = () => {
    setAudioEnabled(!audioEnabled);
    if (!audioEnabled && !audioPlayed) {
      playCustomJingle();
      setAudioPlayed(true);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center transition-all duration-1000 loading-screen no-select ${
        fadeOut ? 'opacity-0 pointer-events-none scale-105' : 'opacity-100 scale-100'
      }`}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-black to-yellow-900/40" />

      {/* Audio control button - Smaller on mobile */}
      <button
        onClick={toggleAudio}
        className="absolute top-4 right-4 md:top-8 md:right-8 z-20 p-2 md:p-4 bg-gray-800/60 hover:bg-gray-700/60 active:bg-gray-700/80 rounded-full transition-all duration-300 group backdrop-blur-sm touch-manipulation"
        title={audioEnabled ? 'Mute audio' : 'Enable audio'}
        aria-label={audioEnabled ? 'Mute audio' : 'Enable audio'}
      >
        {audioEnabled && !audioError ? (
          <Volume2 size={20} className="md:w-6 md:h-6 text-gray-300 group-hover:text-white transition-colors" />
        ) : (
          <VolumeX size={20} className="md:w-6 md:h-6 text-gray-500 group-hover:text-gray-400 transition-colors" />
        )}
      </button>

      {/* Logo and Branding - Optimized for Mobile */}
      <div
        className={`relative z-10 transition-all duration-1000 px-4 ${
          showLogo ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-8'
        }`}
      >
        {/* Logo - Responsive sizing for mobile */}
        <div className="relative mb-8 md:mb-12 lg:mb-16">
          <img
            src="/gol.png"
            alt="DREEMYSTAR"
            className="w-48 h-48 md:w-64 md:h-64 lg:w-80 lg:h-80 mx-auto transition-transform duration-700 hover:scale-105 object-contain"
          />
        </div>

        {/* Branding Text - Responsive for mobile */}
        <div className="text-center mb-8 md:mb-12 lg:mb-20">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 md:mb-4 lg:mb-6 tracking-wider">
            DREEMYSTAR
          </h1>
          <p className="text-gray-300 text-base md:text-xl lg:text-2xl tracking-[0.3em] md:tracking-[0.4em] lg:tracking-[0.5em] uppercase opacity-90 font-light mb-4 md:mb-5 lg:mb-6 px-2">
            Live Concert Streaming
          </p>
          <div className="flex justify-center space-x-2 md:space-x-3">
            <div className="w-2 h-2 md:w-3 md:h-3 bg-purple-400 rounded-full animate-pulse" />
            <div className="w-2 h-2 md:w-3 md:h-3 bg-yellow-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 md:w-3 md:h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>

        {/* Progress bar - Responsive width */}
        <div className="w-full max-w-[500px] mx-auto px-4">
          <div className="relative h-3 md:h-4 bg-gray-800 rounded-full overflow-hidden shadow-inner border border-gray-700">
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-500 via-purple-400 to-yellow-500 rounded-full transition-all duration-500 ease-out loading-glow"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute left-0 top-0 h-full bg-white/30 rounded-full transition-all duration-500 ease-out progress-shimmer"
              style={{ width: `${Math.min(progress + 20, 100)}%` }}
            />
          </div>

          <div className="flex justify-between items-center mt-4 md:mt-6 lg:mt-8 text-sm md:text-base lg:text-lg text-gray-300">
            <span className="tracking-wide font-medium">Loading Experience...</span>
            <span className="font-mono text-purple-400 text-lg md:text-xl font-bold">{progress}%</span>
          </div>
        </div>

        {/* Audio status - Hidden on mobile to save space */}
        <div className="hidden md:flex items-center justify-center mt-8 lg:mt-12 text-gray-400">
          {audioEnabled && !audioError ? (
            <>
              <Volume2 size={20} className="mr-3 animate-pulse text-green-400" />
              <span className="text-base text-green-400 font-medium">Audio Enhanced Experience</span>
            </>
          ) : audioError ? (
            <>
              <VolumeX size={20} className="mr-3 text-red-400" />
              <span className="text-base text-red-400">Audio Unavailable</span>
            </>
          ) : (
            <>
              <VolumeX size={20} className="mr-3" />
              <span className="text-base">Audio Muted</span>
            </>
          )}
        </div>
      </div>

      {/* Grid Overlay */}
      <div className="absolute inset-0 opacity-15 logo-grid pointer-events-none" />

      {/* Footer Branding - Responsive for mobile */}
      <div className="absolute bottom-4 md:bottom-6 lg:bottom-10 left-0 right-0 text-center text-gray-500 px-4">
        <p className="text-xs md:text-sm lg:text-base tracking-wider opacity-80 font-medium leading-tight">
          © 2025 DREEMYSTAR.COM • Premium Live Streaming Platform
        </p>
        <div className="flex items-center justify-center mt-2 md:mt-3 lg:mt-4 space-x-2 md:space-x-3 lg:space-x-4 opacity-60">
          <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-purple-400 rounded-full animate-pulse" />
          <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-yellow-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
          <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.8s' }} />
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;