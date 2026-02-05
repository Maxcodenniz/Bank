import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useStreaming } from '../contexts/StreamingContext';
import AgoraPlayer from '../components/AgoraPlayer';
import { generateToken } from '../lib/agoraClient';
import { Users, Volume2, VolumeX, Play, Pause, X, Maximize, Minimize, Settings, Heart } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useCartStore } from '../store/useCartStore';
import { hasActiveTicket } from '../utils/ticketUtils';
import { Ticket } from 'lucide-react';

type EventRecord = {
  id: string;
  title: string;
  status: string;
  start_time: string | null;
  duration?: number | null; // minutes
  price?: number | null;
  image_url?: string | null;
  viewer_count?: number | null;
  like_count?: number | null;
  profiles?: { username?: string | null; full_name?: string | null } | null;
};

const Watch: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    setIsStreaming,
    setVideoElement,
    setStreamTitle,
    setIsViewerStream,
    setWatchUrl,
    setStreamingClient,
  } = useStreaming();
  const { userProfile, user } = useStore();
  const { guestEmail, addItem, isInCart } = useCartStore();

  const [event, setEvent] = useState<EventRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [showLikeBurst, setShowLikeBurst] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isViewerActive, setIsViewerActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoQuality, setVideoQuality] = useState<string>('auto');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [accessChecking, setAccessChecking] = useState(false);

  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const videoPlayerContainerRef = useRef<HTMLDivElement | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number | null>(null);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
      const isMobileUA = mobileRegex.test(userAgent.toLowerCase());
      const isMobileWidth = window.innerWidth < 768;
      setIsMobile(isMobileUA || isMobileWidth);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-hide controls on mobile after 3 seconds
  useEffect(() => {
    if (isMobile && event?.status === 'live' && channelName) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }

      if (showControls) {
        controlsTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 3000);
      }

      return () => {
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current);
        }
      };
    }
  }, [isMobile, showControls, event?.status, channelName]);

  // Fetch event
  useEffect(() => {
    if (!id) return;

    const fetchEvent = async () => {
      try {
        setLoading(true);
        const { data, error: eventError } = await supabase
          .from('events')
          .select(
            `
              id,
              title,
              status,
              start_time,
              duration,
              price,
              image_url,
              viewer_count,
              profiles:artist_id ( username, full_name )
            `
          )
          .eq('id', id)
          .maybeSingle();

        if (eventError) throw eventError;
        if (!data) throw new Error('Event not found');

        setEvent(data as EventRecord);
        setViewerCount(data.viewer_count || 0);
        setLikeCount(data.like_count || 0);
        setChannelName(`event_${data.id}`);
      } catch (err: any) {
        console.error('Failed to fetch event:', err);
        setError(err?.message || 'Failed to load event');
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id]);

  // Check access for live stream: admins can always watch; others need an active ticket
  useEffect(() => {
    if (!event || !id) {
      setHasAccess(null);
      setAccessChecking(false);
      return;
    }
    const isEventOver =
      event.status === 'ended' ||
      (event.start_time &&
        (event.duration ?? 0) > 0 &&
        new Date(event.start_time).getTime() + (event.duration ?? 0) * 60 * 1000 < Date.now());
    const isLive = event.status === 'live' && !isEventOver;

    if (!isLive) {
      setHasAccess(null);
      setAccessChecking(false);
      return;
    }

    let cancelled = false;
    setAccessChecking(true);
    setHasAccess(null);

    const checkAccess = async () => {
      const isAdmin = userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin';
      if (isAdmin) {
        if (!cancelled) {
          setHasAccess(true);
          setAccessChecking(false);
        }
        return;
      }
      const checkEmail = user?.email || guestEmail || null;
      const hasTicket = await hasActiveTicket(id!, user?.id || null, checkEmail);
      if (!cancelled) {
        setHasAccess(hasTicket);
        setAccessChecking(false);
      }
    };

    checkAccess();
    return () => {
      cancelled = true;
    };
  }, [event, id, user?.id, user?.email, userProfile?.user_type, guestEmail]);

  // Subscribe to event updates
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`event-status-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${id}` },
        (payload: any) => {
          const updated = payload.new as EventRecord;
          setEvent((prev) => (prev ? { ...prev, ...updated } : updated));
          if (updated.viewer_count !== undefined) {
            setViewerCount(updated.viewer_count || 0);
          }
          if (updated.like_count !== undefined) {
            setLikeCount(updated.like_count || 0);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Keep streaming context updated
  useEffect(() => {
    if (!event) return;
    setStreamTitle(event.title);
    setWatchUrl(`/watch/${event.id}`);
  }, [event, setStreamTitle, setWatchUrl]);

  const handleViewerJoin = () => {
    setIsViewerActive(true);
    setIsViewerStream(true);
    setIsStreaming(true);
    if (videoContainerRef.current) {
      setVideoElement(videoContainerRef.current);
    }
  };

  const handleViewerLeave = () => {
    setIsViewerActive(false);
    setIsViewerStream(false);
    setIsStreaming(false);
    setVideoElement(null);
  };

  const triggerLike = async () => {
    if (!event) return;
    setShowLikeBurst(true);
    setTimeout(() => setShowLikeBurst(false), 500);
    setLikeCount((prev) => prev + 1);

    try {
      await supabase.rpc('increment_event_like_count', { event_id: event.id });
    } catch (err) {
      console.warn('Failed to register like:', err);
    }
  };

  const handleViewerTap = () => {
    if (!isMobile) return;
    const now = Date.now();
    if (lastTapRef.current && now - lastTapRef.current < 280) {
      triggerLike();
      lastTapRef.current = null;
      return;
    }
    lastTapRef.current = now;
    setShowControls(true);
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if ((window as any).agoraPlayer) {
      (window as any).agoraPlayer.setVolume(Math.floor(newVolume * 100));
    }
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if ((window as any).agoraPlayer) {
      if (newMutedState) {
        (window as any).agoraPlayer.setVolume(0);
      } else {
        (window as any).agoraPlayer.setVolume(Math.floor(volume * 100));
      }
    }
  };

  const togglePause = () => {
    const newPausedState = !isPaused;
    setIsPaused(newPausedState);
    if ((window as any).agoraPlayer) {
      if (newPausedState) {
        (window as any).agoraPlayer.muteAudio(true);
        (window as any).agoraPlayer.muteVideo(true);
      } else {
        (window as any).agoraPlayer.muteAudio(isMuted);
        (window as any).agoraPlayer.muteVideo(false);
      }
    }
  };

  const toggleFullscreen = async () => {
    const videoContainer = videoPlayerContainerRef.current;
    if (!videoContainer) return;

    try {
      if (!document.fullscreenElement) {
        if (window.innerWidth < 768 && (screen.orientation as any)?.lock) {
          try {
            await (screen.orientation as any).lock('landscape');
          } catch (orientationError) {
            console.warn('Could not lock orientation:', orientationError);
          }
        }
        if ((videoContainer as any).requestFullscreen) {
          await (videoContainer as any).requestFullscreen();
        }
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen failed:', err);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const generateViewerToken = async (channel: string, uid: number, role = 'audience') => {
    return generateToken(channel, uid, role, 3600);
  };

  const handleGetTicket = () => {
    if (!event) return;
    const price = event.price ?? 0;
    if (!isInCart(event.id)) {
      addItem({
        eventId: event.id,
        eventTitle: event.title,
        eventImage: event.image_url || undefined,
        price,
        artistName: event.profiles?.username || undefined, // Only show username to fans (full_name is confidential)
        eventDate: event.start_time || undefined,
      });
    }
    navigate('/cart');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading event...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-gray-300">
          <p>{error || 'Event not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Event is over if status is 'ended' or planned end time has passed (handles stale "live" from DB)
  const isEventOver =
    event.status === 'ended' ||
    (event.start_time &&
      (event.duration ?? 0) > 0 &&
      new Date(event.start_time).getTime() + (event.duration ?? 0) * 60 * 1000 < Date.now());
  const isLive = event.status === 'live' && !isEventOver;
  const showLivePlayer = isLive && channelName && hasAccess === true && !accessChecking;
  const needsTicket = isLive && !accessChecking && hasAccess === false;

  return (
    <div className={`min-h-screen bg-gray-900 ${showLivePlayer ? 'pt-0' : 'pt-16'}`}>
      {showQuitConfirm && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl p-6 md:p-8 max-w-sm w-full border border-white/10 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="w-8 h-8 bg-red-500 rounded-full"></div>
              </div>
              <h3 className="text-white text-xl md:text-2xl font-bold mb-2">Quit Watching?</h3>
              <p className="text-gray-400 text-sm md:text-base">Are you sure you want to leave this live stream?</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate('/', { replace: true })}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-bold transition-all transform active:scale-95 shadow-lg"
              >
                Yes, Quit
              </button>
              <button
                onClick={() => setShowQuitConfirm(false)}
                className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all transform active:scale-95 backdrop-blur-sm border border-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showLivePlayer ? (
        <div className="fixed inset-0 bg-black z-40" onClick={handleViewerTap} onTouchStart={handleViewerTap}>
          <style>{`
            .watch-fullscreen {
              width: 100vw;
              height: 100vh;
            }
            .watch-fullscreen video {
              width: 100vw !important;
              height: 100vh !important;
              object-fit: contain !important;
              object-position: center !important;
              background: #000 !important;
            }
            .like-burst {
              animation: like-pop 0.5s ease;
            }
            @keyframes like-pop {
              0% { transform: scale(0.6); opacity: 0; }
              60% { transform: scale(1.1); opacity: 1; }
              100% { transform: scale(1.2); opacity: 0; }
            }
          `}</style>
          <div ref={videoPlayerContainerRef} className="absolute inset-0 w-screen h-screen bg-black watch-fullscreen">
            <AgoraPlayer
              channelName={channelName}
              generateTokenFn={generateViewerToken}
              uid={Math.floor(Math.random() * 1000000)}
              onViewerJoin={handleViewerJoin}
              onViewerLeave={handleViewerLeave}
              onVideoContainerReady={(container) => {
                videoContainerRef.current = container;
              }}
              onClientReady={(client) => {
                setStreamingClient(client);
              }}
              videoQuality={videoQuality}
            />

            {showControls && (
              <>
                {!isMobile && (
                  <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent p-4 z-10">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
                      >
                        <X className="h-6 w-6 text-white" />
                      </button>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center text-white">
                          <Users className="h-5 w-5 mr-2" />
                          <span className="font-semibold">{viewerCount}</span>
                        </div>
                        <div className="flex items-center bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                          <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                          LIVE
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isMobile ? (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePause();
                          }}
                          className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"
                        >
                          {isPaused ? <Play className="h-6 w-6 text-white ml-1" /> : <Pause className="h-6 w-6 text-white" />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMute();
                          }}
                          className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"
                        >
                          {isMuted ? <VolumeX className="h-6 w-6 text-white" /> : <Volume2 className="h-6 w-6 text-white" />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFullscreen();
                          }}
                          className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"
                        >
                          {isFullscreen ? <Minimize className="h-6 w-6 text-white" /> : <Maximize className="h-6 w-6 text-white" />}
                        </button>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="flex items-center bg-red-600 text-white px-3 py-1.5 rounded-full text-sm font-semibold">
                          <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
                          LIVE
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(-1);
                          }}
                          className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"
                        >
                          <X className="h-6 w-6 text-white" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center text-white text-sm">
                      <Users className="h-4 w-4 mr-2" />
                      <span>{viewerCount} watching</span>
                    </div>
                  </div>
                ) : (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 md:p-4 z-10">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 md:space-x-4 flex-1 min-w-0">
                        <button
                          onClick={togglePause}
                          className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-white/20 hover:bg-white/30 rounded-full transition-colors flex-shrink-0"
                        >
                          {isPaused ? <Play className="h-5 w-5 md:h-6 md:w-6 text-white ml-0.5 md:ml-1" /> : <Pause className="h-5 w-5 md:h-6 md:w-6 text-white" />}
                        </button>

                        <div className="flex items-center space-x-1 md:space-x-2 flex-1 min-w-0">
                          <button onClick={toggleMute} className="text-white hover:text-purple-400 transition-colors flex-shrink-0">
                            {isMuted ? <VolumeX className="h-5 w-5 md:h-6 md:w-6" /> : <Volume2 className="h-5 w-5 md:h-6 md:w-6" />}
                          </button>

                          <div className="w-16 md:w-24 flex-1">
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={isMuted ? 0 : volume}
                              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                              className="w-full h-1.5 md:h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isViewerActive && (
                          <div className="relative quality-menu-container">
                            <button
                              onClick={() => setShowQualityMenu(!showQualityMenu)}
                              className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                              title="Video Quality"
                            >
                              <Settings className="h-5 w-5 md:h-6 md:w-6 text-white" />
                            </button>
                            {showQualityMenu && (
                              <div className="absolute bottom-full right-0 mb-2 bg-gray-900/95 backdrop-blur-xl rounded-lg shadow-2xl border border-white/10 py-2 min-w-[120px] z-50">
                                {['auto', '1080p', '720p', '480p', '360p'].map((quality) => (
                                  <button
                                    key={quality}
                                    onClick={() => {
                                      setVideoQuality(quality);
                                      setShowQualityMenu(false);
                                    }}
                                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                                      videoQuality === quality
                                        ? 'bg-purple-600/30 text-white'
                                        : 'text-gray-300 hover:bg-white/10 hover:text-white'
                                    }`}
                                  >
                                    {quality === 'auto' ? 'Auto' : quality.toUpperCase()}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <button
                          onClick={toggleFullscreen}
                          className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                        >
                          {isFullscreen ? <Minimize className="h-5 w-5 md:h-6 md:w-6 text-white" /> : <Maximize className="h-5 w-5 md:h-6 md:w-6 text-white" />}
                        </button>
                        <button
                          onClick={() => setShowQuitConfirm(true)}
                          className="bg-gradient-to-r from-red-600 via-red-600 to-red-700 hover:from-red-700 hover:via-red-700 hover:to-red-800 text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-1 transition-all duration-300 font-semibold text-xs md:text-sm"
                          title="Quit and leave this page"
                          type="button"
                        >
                          Quit
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Like burst */}
            {showLikeBurst && (
              <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
                <Heart className="w-16 h-16 text-pink-500 like-burst" fill="currentColor" />
              </div>
            )}

            {/* Like button (right side) */}
            <div className="absolute right-4 bottom-24 z-30 flex flex-col items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  triggerLike();
                }}
                className="p-3 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
                title="Like"
              >
                <Heart className="w-6 h-6 text-pink-500" fill="currentColor" />
              </button>
              <div className="text-xs text-white/80">{likeCount}</div>
            </div>
          </div>
        </div>
      ) : accessChecking && isLive ? (
        <div className="container mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
          <div className="bg-gray-800 rounded-xl p-8 text-center max-w-md">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-gray-300 font-medium">Checking access...</p>
            <p className="text-gray-500 text-sm mt-1">Verifying your ticket</p>
          </div>
        </div>
      ) : needsTicket ? (
        <div className="container mx-auto px-4 py-8">
          <div className="bg-gray-800 rounded-xl p-8 text-center max-w-lg mx-auto border border-amber-500/30">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Ticket className="w-8 h-8 text-amber-400" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{event.title}</h1>
            <p className="text-gray-400 mb-4">You need a ticket to watch this live stream</p>
            <p className="text-gray-500 text-sm mb-6">
              Purchase a ticket to get instant access, or sign in with the account you used to buy.
            </p>
            {event.price != null && event.price > 0 && (
              <p className="text-lg font-semibold text-white mb-6">
                €{(event.price as number).toFixed(2)} per ticket
              </p>
            )}
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={handleGetTicket}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-purple-500/30"
              >
                {isInCart(event.id) ? 'Go to cart & pay' : 'Get ticket'}
              </button>
              <button
                onClick={() => navigate(`/`)}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all border border-white/10"
              >
                Browse events
              </button>
              <button
                onClick={() => navigate(-1)}
                className="px-6 py-3 text-gray-400 hover:text-white rounded-xl font-medium transition-all"
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="container mx-auto px-4 py-8">
          <div className="bg-gray-800 rounded-xl p-6 text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-white">{event.title}</h1>
            <p className="text-gray-400 mt-1">{event.profiles?.username || 'Unknown Artist'}</p>
            <div className="mt-4 inline-flex items-center bg-gray-700/50 text-gray-300 px-4 py-2 rounded-full text-sm font-semibold">
              {event.status === 'scheduled' ? 'Scheduled' : isEventOver ? 'Stream has ended' : event.status === 'ended' ? 'Ended' : 'Not live'}
            </div>
            {event.start_time && (
              <p className="text-gray-400 text-sm mt-3">{new Date(event.start_time).toLocaleString()}</p>
            )}
            {event.description && (
              <p className="text-gray-300 mt-4">{event.description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Watch;
