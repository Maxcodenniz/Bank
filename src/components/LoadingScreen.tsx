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
      className={`fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center min-h-screen w-full transition-all duration-1000 loading-screen no-select overflow-auto ${
        fadeOut ? 'opacity-0 pointer-events-none scale-105' : 'opacity-100 scale-100'
      }`}
    >
      {/* Background - full bleed on all viewports */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-black to-yellow-900/40" />

      {/* Audio control - responsive position and size */}
      <button
        onClick={toggleAudio}
        className="absolute top-3 right-3 sm:top-4 sm:right-4 md:top-6 md:right-6 lg:top-8 lg:right-8 xl:top-10 xl:right-10 z-20 p-2 sm:p-3 md:p-4 bg-gray-800/60 hover:bg-gray-700/60 active:bg-gray-700/80 rounded-full transition-all duration-300 group backdrop-blur-sm touch-manipulation"
        title={audioEnabled ? 'Mute audio' : 'Enable audio'}
        aria-label={audioEnabled ? 'Mute audio' : 'Enable audio'}
      >
        {audioEnabled && !audioError ? (
          <Volume2 className="w-5 h-5 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 text-gray-300 group-hover:text-white transition-colors" />
        ) : (
          <VolumeX className="w-5 h-5 sm:w-5 sm:h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 text-gray-500 group-hover:text-gray-400 transition-colors" />
        )}
      </button>

      {/* Content wrapper: centered, responsive padding, max-width on large desktops so layout doesn't stretch */}
      <div
        className={`relative z-10 w-full flex flex-col items-center justify-center transition-all duration-1000 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-12 sm:py-16 md:py-20 max-w-full xl:max-w-4xl 2xl:max-w-5xl ${
          showLogo ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-8'
        }`}
      >
        {/* Logo - fluid sizing from mobile to desktop */}
        <div className="relative mb-6 sm:mb-8 md:mb-10 lg:mb-12 xl:mb-14 2xl:mb-16">
          <img
            src="/gol.png"
            alt="DREEMYSTAR"
            className="w-44 h-44 sm:w-52 sm:h-52 md:w-64 md:h-64 lg:w-72 lg:h-72 xl:w-80 xl:h-80 2xl:w-96 2xl:h-96 mx-auto transition-transform duration-700 hover:scale-105 object-contain flex-shrink-0"
          />
        </div>

        {/* Branding text - responsive typography scale */}
        <div className="text-center mb-6 sm:mb-8 md:mb-10 lg:mb-12 xl:mb-14 2xl:mb-16">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl font-bold text-white mb-2 sm:mb-3 md:mb-4 lg:mb-5 xl:mb-6 tracking-wider">
            DREEMYSTAR
          </h1>
          <p className="text-gray-300 text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl 2xl:text-3xl tracking-[0.2em] sm:tracking-[0.3em] md:tracking-[0.4em] lg:tracking-[0.5em] uppercase opacity-90 font-light mb-3 sm:mb-4 md:mb-5 lg:mb-6 px-2">
            Live Concert Streaming
          </p>
          <div className="flex justify-center space-x-2 sm:space-x-3">
            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 bg-purple-400 rounded-full animate-pulse" />
            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 bg-yellow-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        </div>

        {/* Progress bar - responsive width and height */}
        <div className="w-full max-w-[320px] sm:max-w-[400px] md:max-w-[480px] lg:max-w-[520px] xl:max-w-[560px] 2xl:max-w-[600px] mx-auto">
          <div className="relative h-2.5 sm:h-3 md:h-4 lg:h-[18px] xl:h-5 bg-gray-800 rounded-full overflow-hidden shadow-inner border border-gray-700">
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-500 via-purple-400 to-yellow-500 rounded-full transition-all duration-500 ease-out loading-glow"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute left-0 top-0 h-full bg-white/30 rounded-full transition-all duration-500 ease-out progress-shimmer"
              style={{ width: `${Math.min(progress + 20, 100)}%` }}
            />
          </div>

          <div className="flex justify-between items-center mt-3 sm:mt-4 md:mt-5 lg:mt-6 xl:mt-8 text-xs sm:text-sm md:text-base lg:text-lg xl:text-xl text-gray-300">
            <span className="tracking-wide font-medium">Loading Experience...</span>
            <span className="font-mono text-purple-400 text-base sm:text-lg md:text-xl lg:text-2xl font-bold tabular-nums">{progress}%</span>
          </div>
        </div>

        {/* Audio status - visible from md up */}
        <div className="hidden md:flex items-center justify-center mt-6 md:mt-8 lg:mt-10 xl:mt-12 2xl:mt-14 text-gray-400">
          {audioEnabled && !audioError ? (
            <>
              <Volume2 className="w-5 h-5 lg:w-5 lg:h-5 xl:w-6 xl:h-6 mr-2 lg:mr-3 animate-pulse text-green-400 flex-shrink-0" />
              <span className="text-sm md:text-base lg:text-lg xl:text-xl text-green-400 font-medium">Audio Enhanced Experience</span>
            </>
          ) : audioError ? (
            <>
              <VolumeX className="w-5 h-5 lg:w-5 lg:h-5 xl:w-6 xl:h-6 mr-2 lg:mr-3 text-red-400 flex-shrink-0" />
              <span className="text-sm md:text-base lg:text-lg xl:text-xl text-red-400">Audio Unavailable</span>
            </>
          ) : (
            <>
              <VolumeX className="w-5 h-5 lg:w-5 lg:h-5 xl:w-6 xl:h-6 mr-2 lg:mr-3 flex-shrink-0" />
              <span className="text-sm md:text-base lg:text-lg xl:text-xl">Audio Muted</span>
            </>
          )}
        </div>
      </div>

      {/* Grid Overlay */}
      <div className="absolute inset-0 opacity-15 logo-grid pointer-events-none" />

      {/* Footer - responsive on all screens */}
      <div className="absolute bottom-3 left-0 right-0 text-center text-gray-500 px-3 sm:px-4 md:px-6 lg:px-8 xl:px-10 sm:bottom-4 md:bottom-6 lg:bottom-8 xl:bottom-10">
        <p className="text-[10px] sm:text-xs md:text-sm lg:text-base xl:text-lg 2xl:text-xl tracking-wider opacity-80 font-medium leading-tight max-w-full">
          © 2025 DREEMYSTAR.COM • Premium Live Streaming Platform
        </p>
        <div className="flex items-center justify-center mt-1.5 sm:mt-2 md:mt-3 lg:mt-4 space-x-2 sm:space-x-3 opacity-60">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-purple-400 rounded-full animate-pulse" />
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0.8s' }} />
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;