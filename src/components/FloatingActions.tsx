import React, { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';

const FloatingActions: React.FC = () => {
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const location = useLocation();
  const { user, userProfile, setUserProfile } = useStore();

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = document.documentElement.clientHeight;
      const scrollBottom = scrollHeight - scrollTop - clientHeight;

      // Show up arrow when scrolled down more than 300px
      setShowTop(scrollTop > 300);
      
      // Show down arrow when not at bottom (more than 100px from bottom)
      setShowBottom(scrollBottom > 100);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial position

    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    });
  };

  const refreshPlatform = async () => {
    setIsRefreshing(true);
    
    try {
      const { supabase } = await import('../lib/supabaseClient');
      
      // Refresh user profile if logged in
      if (user?.id) {
        const { data: freshProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (freshProfile) {
          setUserProfile(freshProfile);
        }
      }

      // Refresh auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Session refreshed automatically by Supabase
      }

      // Dispatch a custom event that components can listen to for data refresh
      window.dispatchEvent(new CustomEvent('platformRefresh', {
        detail: { timestamp: Date.now() }
      }));

      // Small delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (error) {
      console.error('Error refreshing platform:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Hide on certain pages (like go-live)
  const hideOnPages = ['/go-live'];
  if (hideOnPages.includes(location.pathname)) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-40 flex flex-col gap-2">
      {/* Scroll to Bottom Button */}
      {showBottom && (
        <button
          onClick={scrollToBottom}
          className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 transition-all duration-300 flex items-center justify-center group active:scale-95"
          title="Scroll to bottom"
          aria-label="Scroll to bottom"
        >
          <ChevronDown className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Refresh Button */}
      <button
        onClick={refreshPlatform}
        disabled={isRefreshing}
        className={`w-10 h-10 md:w-11 md:h-11 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/50 hover:shadow-xl hover:shadow-blue-500/60 transition-all duration-300 flex items-center justify-center group active:scale-95 ${
          isRefreshing ? 'opacity-75 cursor-not-allowed' : ''
        }`}
        title="Refresh platform"
        aria-label="Refresh platform"
      >
        <RefreshCw 
          className={`w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform ${isRefreshing ? 'animate-spin' : ''}`} 
        />
      </button>

      {/* Scroll to Top Button */}
      {showTop && (
        <button
          onClick={scrollToTop}
          className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-gradient-to-br from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg shadow-green-500/50 hover:shadow-xl hover:shadow-green-500/60 transition-all duration-300 flex items-center justify-center group active:scale-95"
          title="Scroll to top"
          aria-label="Scroll to top"
        >
          <ChevronUp className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform" />
        </button>
      )}
    </div>
  );
};

export default FloatingActions;

