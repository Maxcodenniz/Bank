// src/components/AgoraStreamingStudio.tsx

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createClient, createLocalTracks, generateToken, joinChannel, leaveChannel, updateStreamStatus, validateAgoraConfig } from '../lib/agoraClient';
import { registerBroadcasterSession, updateBroadcasterHeartbeat, removeBroadcasterSession, startBroadcasterHeartbeat } from '../lib/broadcasterSession';
import { useStore } from '../store/useStore';
import { useStreaming } from '../contexts/StreamingContext';
import { supabase } from '../lib/supabaseClient';
import CameraStats from './CameraStats';
import CameraSelector from './CameraSelector';
import { MessageCircle, Send, X, Image, Mic, MicOff, Smile, Reply, Trash2, Users, Maximize2, Minimize2, CheckCircle, Video, VideoOff, BarChart, Circle, Square } from 'lucide-react';

const AgoraStreamingStudio: React.FC<{ concert: any; supabase?: any; user?: any }> = ({ concert }) => {
  const { userProfile, user } = useStore();
  const { 
    isStreaming: globalIsStreaming,
    setIsStreaming: setGlobalStreaming, 
    setStreamTitle: setGlobalStreamTitle,
    setStreamingEventId,
    streamingEventId: contextEventId,
    streamingClient: contextClient,
    setStreamingClient: setContextClient,
    streamingTracks: contextTracks,
    setStreamingTracks: setContextTracks,
    streamingUid: contextUid,
    setStreamingUid: setContextUid,
  } = useStreaming();
  const [client, setClient] = useState<any | null>(null);
  const [localTracks, setLocalTracks] = useState<any | null>(null);
  const [cameraInitialized, setCameraInitialized] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState<string>('');
  const [viewerCount, setViewerCount] = useState(0);
  const [streamingUid, setStreamingUid] = useState<number | null>(null);
  const [showChat, setShowChat] = useState(true);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [chatMessages, setChatMessages] = useState<Array<{id: string; user_id: string; username: string; message: string; created_at: string; avatar_url?: string; reply_to_id?: string; reply_to_username?: string; image_url?: string; voice_url?: string; message_type?: string}>>([]);
  const [chatInput, setChatInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<{id: string; username: string; message: string} | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordingEnabled, setRecordingEnabled] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLDivElement | null>(null);
  const broadcasterHeartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const chatSubscriptionRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const [isUserAtBottom, setIsUserAtBottom] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenControlsVisible, setFullscreenControlsVisible] = useState(false);
  const fullscreenControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isCameraMuted, setIsCameraMuted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clientRef = useRef<any | null>(null);
  const localTracksRef = useRef<any | null>(null);
  const isStreamingRef = useRef(false);
  const hasRestoredRef = useRef(false); // Track if we've already restored

  const channelName = `event_${concert.id}`;

  // Restore streaming state from context if available - runs on mount and when context changes
  useEffect(() => {
    // If there's an active stream in context and we're on the same event, restore it
    if (globalIsStreaming && contextClient && contextTracks && contextUid && contextEventId && concert?.id === contextEventId) {
      // Only restore client/tracks if not already set
      if (!clientRef.current) {
        console.log('🔄 Restoring active stream - reusing existing client and tracks');
        setClient(contextClient);
        clientRef.current = contextClient;
        hasRestoredRef.current = true;
      }
      
      if (!localTracksRef.current) {
        setLocalTracks(contextTracks);
        localTracksRef.current = contextTracks;
      }
      
      if (!isStreaming) {
        setIsStreaming(true);
        isStreamingRef.current = true;
      }
      
      if (!streamingUid) {
        setStreamingUid(contextUid);
      }
      
      if (!cameraInitialized) {
        setCameraInitialized(true);
      }
      
      // Always restore video preview when component is visible and tracks exist
      const restoreVideoPreview = () => {
        if (videoRef.current && contextTracks && contextTracks[1]) {
          try {
            // Check if video is already playing
            const videoElement = videoRef.current.querySelector('video');
            const isVideoVisible = videoElement && 
                                 videoElement.offsetWidth > 0 && 
                                 videoElement.offsetHeight > 0;
            
            if (!isVideoVisible || !contextTracks[1].isPlaying) {
              console.log('🔄 Restoring video preview');
              // Stop if playing elsewhere
              if (contextTracks[1].isPlaying) {
                contextTracks[1].stop();
              }
              // Play in container
              contextTracks[1].play(videoRef.current);
              
              // Ensure video element styling
              setTimeout(() => {
                const videoEl = videoRef.current?.querySelector('video');
                if (videoEl) {
                  videoEl.style.width = '100%';
                  videoEl.style.height = '100%';
                  videoEl.style.objectFit = 'cover';
                  videoEl.style.display = 'block';
                  console.log('✅ Video preview restored and styled');
                }
              }, 100);
            }
          } catch (e) {
            console.warn('Error restoring video preview:', e);
            // Retry after delay
            setTimeout(() => {
              if (videoRef.current && contextTracks[1]) {
                try {
                  if (contextTracks[1].isPlaying) {
                    contextTracks[1].stop();
                  }
                  contextTracks[1].play(videoRef.current);
                  console.log('✅ Restored video preview (retry)');
                } catch (e2) {
                  console.warn('Error playing restored video (retry):', e2);
                }
              }
            }, 500);
          }
        }
        
      };
      
      // Restore immediately and also after delays to ensure DOM is ready
      restoreVideoPreview();
      const timeout1 = setTimeout(restoreVideoPreview, 100);
      const timeout2 = setTimeout(restoreVideoPreview, 500);
      
      return () => {
        clearTimeout(timeout1);
        clearTimeout(timeout2);
      };
    }
    
    // Create new client only if not restoring and no client exists
    if (!clientRef.current) {
      const c = createClient({ mode: 'live', codec: 'vp8' });
      
      c.on('user-published', async (user: any, mediaType: any) => {
        try { 
          await c.subscribe(user, mediaType); 
          console.log('Subscribed to user:', user.uid, mediaType);
        } catch (e) { 
          console.warn('Subscribe failed:', e); 
        }
      });

      c.on('user-joined', (user: any) => {
        console.log('User joined channel:', user.uid);
        // Note: Viewer count is now tracked from database, not Agora events
      });
      
      c.on('user-left', (user: any) => {
        console.log('User left channel:', user.uid);
        // Note: Viewer count is now tracked from database, not Agora events
      });

      // Add connection state monitoring
      c.on('connection-state-change', (curState: string, prevState: string) => {
        console.log(`Streamer connection state: ${prevState} -> ${curState}`);
        if (curState === 'DISCONNECTED' && isStreaming) {
          setError('Connection lost during streaming. Please check your internet connection.');
        }
      });

      // Add exception handling
      c.on('exception', (event: any) => {
        console.warn(`Streamer exception: ${event.code} - ${event.msg}`);
        if (event.code === 'CAN_NOT_GET_GATEWAY_SERVER') {
          setError('Cannot connect to streaming server. Please check your connection and try again.');
        }
      });

      setClient(c);
      clientRef.current = c;
      // Store client in context for persistence (only if not already stored)
      if (!contextClient) {
        setContextClient(c);
      }

      return () => {
        // Don't cleanup if streaming is active - cleanup when stopStream is called explicitly
        // Use ref to get current streaming state (not stale closure)
        const currentIsStreaming = isStreamingRef.current;
        
        if (!currentIsStreaming) {
          if (broadcasterHeartbeatRef.current) {
            clearInterval(broadcasterHeartbeatRef.current);
          }

          if (localTracksRef.current) {
            try {
              localTracksRef.current[0]?.close();
              localTracksRef.current[1]?.close();
            } catch (e) {
              console.warn('Error closing tracks:', e);
            }
          }
          try {
            c.leave();
          } catch (e) {
            console.warn('Error leaving channel:', e);
          }
        } else {
          console.log('⚠️ Component unmounting but stream is active - keeping connection alive');
        }
      };
    }
  }, []); // Empty deps - only run once on mount/unmount

  const fetchDevices = async () => {
    try {
      // Request permissions first
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        .then(stream => stream.getTracks().forEach(track => track.stop()))
        .catch(() => {});
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      const microphones = devices.filter(d => d.kind === 'audioinput');
      
      console.log('Available cameras:', cameras.length);
      console.log('Available microphones:', microphones.length);
      
      if (cameras[0]) setSelectedCameraId(cameras[0].deviceId);
      if (microphones[0]) setSelectedMicrophoneId(microphones[0].deviceId);
    } catch (err) {
      console.error('Device enumeration failed', err);
      setError('Failed to access camera and microphone. Please check permissions.');
    }
  };

  useEffect(() => { 
    fetchDevices();
    fetchRecordingConfig();
    fetchChatConfig();
  }, []);

  // Set up real-time subscription for viewer count from database
  useEffect(() => {
    if (!concert?.id) return;

    // Fetch initial viewer count
    const fetchViewerCount = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('viewer_count')
          .eq('id', concert.id)
          .single();

        if (!error && data) {
          setViewerCount(data.viewer_count || 0);
          console.log('📊 Initial viewer count:', data.viewer_count);
        }
      } catch (err) {
        console.warn('Error fetching viewer count:', err);
      }
    };

    fetchViewerCount();

    // Set up real-time subscription
    const channel = supabase
      .channel(`event-viewer-count-${concert.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'events',
          filter: `id=eq.${concert.id}`,
        },
        (payload) => {
          const newData = payload.new as any;
          if (newData.viewer_count !== undefined && newData.viewer_count !== null) {
            setViewerCount(newData.viewer_count);
            console.log('📊 Viewer count updated from database:', newData.viewer_count);
          }
        }
      )
      .subscribe();

    // Also poll periodically as backup (every 5 seconds)
    const pollInterval = setInterval(() => {
      fetchViewerCount();
    }, 5000);

    return () => {
      channel.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [concert?.id]);

  // Restore video preview when component becomes visible again (e.g., after tab switch)
  useEffect(() => {
    if (!localTracks || !cameraInitialized) return;

    const videoTrack = localTracks[1]; // Video track is at index 1
    if (!videoTrack) return;

    // Function to restore video preview
    const restoreVideo = () => {
      if (!videoRef.current || !videoTrack) return;
      
      try {
        // Check if video element exists and is visible
        const videoElement = videoRef.current.querySelector('video');
        const rect = videoRef.current.getBoundingClientRect();
        const isContainerVisible = rect.width > 0 && rect.height > 0 && 
                                  rect.top < window.innerHeight && 
                                  rect.bottom > 0;
        
        // If container is visible but video is not playing or not visible
        if (isContainerVisible) {
          const needsRestore = !videoTrack.isPlaying || 
                              !videoElement || 
                              videoElement.offsetWidth === 0 || 
                              videoElement.offsetHeight === 0 ||
                              videoElement.style.display === 'none' ||
                              videoElement.style.visibility === 'hidden';
          
          if (needsRestore) {
            console.log('🔄 Restoring video preview - container visible but video not playing');
            
            // Stop if already playing elsewhere
            if (videoTrack.isPlaying) {
              try {
                videoTrack.stop();
              } catch (e) {
                console.warn('Error stopping video track:', e);
              }
            }
            
            // Clear container and replay
            if (videoRef.current) {
              videoRef.current.innerHTML = '';
            }
            
            // Small delay before replaying to ensure container is ready
            setTimeout(() => {
              if (videoRef.current && videoTrack) {
                try {
                  videoTrack.play(videoRef.current);
                  
                  // Ensure video element styling
                  setTimeout(() => {
                    const videoEl = videoRef.current?.querySelector('video');
                    if (videoEl) {
                      videoEl.style.width = '100%';
                      videoEl.style.height = '100%';
                      videoEl.style.objectFit = 'cover';
                      videoEl.style.display = 'block';
                      videoEl.style.visibility = 'visible';
                      console.log('✅ Video preview restored and styled');
                    }
                  }, 100);
                } catch (playError) {
                  console.warn('Error playing video track:', playError);
                }
              }
            }, 50);
          }
        }
      } catch (error) {
        console.warn('Error in restoreVideo:', error);
      }
    };

    // Use Intersection Observer to detect when video container becomes visible
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0) {
            restoreVideo();
          }
        });
      },
      {
        threshold: [0, 0.1, 0.5, 1.0],
        rootMargin: '0px'
      }
    );

    if (videoRef.current) {
      observer.observe(videoRef.current);
    }

    // Check immediately and after delays to ensure DOM is ready
    restoreVideo();
    const timeout1 = setTimeout(restoreVideo, 200);
    const timeout2 = setTimeout(restoreVideo, 500);

    return () => {
      observer.disconnect();
      clearTimeout(timeout1);
      clearTimeout(timeout2);
    };
  }, [localTracks, cameraInitialized, isStreaming]);

  const toggleCameraMute = useCallback(async () => {
    if (!localTracks?.[1]) return;
    try {
      const next = !isCameraMuted;
      await (localTracks[1] as any).setEnabled(!next);
      setIsCameraMuted(next);
    } catch (e) {
      console.warn('Toggle camera mute failed:', e);
    }
  }, [localTracks, isCameraMuted]);

  const toggleMicMute = useCallback(async () => {
    if (!localTracks?.[0]) return;
    try {
      const next = !isMicMuted;
      await (localTracks[0] as any).setEnabled(!next);
      setIsMicMuted(next);
    } catch (e) {
      console.warn('Toggle mic mute failed:', e);
    }
  }, [localTracks, isMicMuted]);

  const fetchRecordingConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'recording_enabled')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching recording config:', error);
        return;
      }

      if (data) {
        setRecordingEnabled(data.value === true || data.value === 'true');
      }
    } catch (err) {
      console.error('Error fetching recording config:', err);
    }
  };

  const fetchChatConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'live_chat_enabled')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching chat config:', error);
        return;
      }

      if (data) {
        const enabled = data.value === true || data.value === 'true';
        setChatEnabled(enabled);
        // If chat is disabled, also hide it
        if (!enabled) {
          setShowChat(false);
        }
      }
    } catch (err) {
      console.error('Error fetching chat config:', err);
    }
  };

  // Load and subscribe to chat messages when streaming
  useEffect(() => {
    if (isStreaming && concert.id) {
      loadChatMessages();
      subscribeToChat();
    }

    return () => {
      if (chatSubscriptionRef.current) {
        chatSubscriptionRef.current.unsubscribe();
        chatSubscriptionRef.current = null;
      }
      // Cleanup scroll timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [isStreaming, concert.id]);

  // Check if user is at bottom of chat
  const checkIfAtBottom = useCallback(() => {
    if (!chatContainerRef.current) return false;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    // Allow 50px threshold for "at bottom"
    return scrollHeight - scrollTop - clientHeight < 50;
  }, []);

  // Optimized scroll to bottom function
  const scrollToBottom = useCallback((force = false) => {
    if (!chatContainerRef.current) return;
    
    // Only auto-scroll if user is at bottom or forced
    if (!force && !isUserAtBottom) return;

    // Use requestAnimationFrame for smoother scrolling
    requestAnimationFrame(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    });
  }, [isUserAtBottom]);

  // Handle scroll events with debouncing
  const handleChatScroll = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserAtBottom(checkIfAtBottom());
    }, 100);
  }, [checkIfAtBottom]);

  // Auto-scroll chat to bottom when new messages arrive (only if user is at bottom)
  useEffect(() => {
    if (chatMessages.length > 0 && isUserAtBottom) {
      scrollToBottom(true);
    }
  }, [chatMessages.length, isUserAtBottom, scrollToBottom]);

  // Initial scroll to bottom when chat opens
  useEffect(() => {
    if (showChat && chatMessages.length > 0) {
      setTimeout(() => scrollToBottom(true), 100);
    }
  }, [showChat, scrollToBottom]);

  const loadChatMessages = async () => {
    if (!concert.id) return;
    
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          id,
          user_id,
          message,
          created_at,
          reply_to_id,
          image_url,
          voice_url,
          message_type,
          profiles:user_id (
            username,
            avatar_url
          ),
          reply_to:reply_to_id (
            id,
            message,
            profiles:user_id (
              username
            )
          )
        `)
        .eq('event_id', concert.id)
        .is('deleted_at', null) // Only load non-deleted messages
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;

      const formattedMessages = (data || []).map(msg => ({
        id: msg.id,
        user_id: msg.user_id,
        username: (msg.profiles as any)?.username || 'Anonymous',
        message: msg.message,
        created_at: msg.created_at,
        avatar_url: (msg.profiles as any)?.avatar_url,
        reply_to_id: msg.reply_to_id,
        reply_to_username: (msg.reply_to as any)?.profiles?.username,
        reply_to_message: (msg.reply_to as any)?.message,
        image_url: msg.image_url,
        voice_url: msg.voice_url,
        message_type: msg.message_type || 'text',
        deleted_at: msg.deleted_at,
        deleted_for_all: msg.deleted_for_all
      })).filter(msg => {
        // Filter out messages deleted for all, or deleted for this user
        if (msg.deleted_at) {
          if (msg.deleted_for_all) return false;
          if (msg.user_id === user?.id) return false; // Deleted for sender
        }
        return true;
      });

      setChatMessages(formattedMessages);
    } catch (err) {
      console.error('Error loading chat messages:', err);
    }
  };

  const subscribeToChat = () => {
    if (!concert.id) return;

    if (chatSubscriptionRef.current) {
      chatSubscriptionRef.current.unsubscribe();
    }

    const channel = supabase
      .channel(`chat-studio-${concert.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `event_id=eq.${concert.id}`
        },
        async (payload) => {
          const newMessage = payload.new as any;
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', newMessage.user_id)
            .single();

          // Fetch reply info if exists
          let replyToUsername = null;
          if (newMessage.reply_to_id) {
            const { data: replyMsg } = await supabase
              .from('chat_messages')
              .select(`
                message,
                profiles:user_id (
                  username
                )
              `)
              .eq('id', newMessage.reply_to_id)
              .single();
            replyToUsername = (replyMsg?.profiles as any)?.username;
          }

          setChatMessages(prev => {
            if (prev.some(msg => msg.id === newMessage.id)) {
              return prev;
            }
            const newMessages = [...prev, {
              id: newMessage.id,
              user_id: newMessage.user_id,
              username: profile?.username || 'Anonymous',
              message: newMessage.message,
              created_at: newMessage.created_at,
              avatar_url: profile?.avatar_url,
              reply_to_id: newMessage.reply_to_id,
              reply_to_username: replyToUsername,
              image_url: newMessage.image_url,
              voice_url: newMessage.voice_url,
              message_type: newMessage.message_type || 'text',
              deleted_at: newMessage.deleted_at,
              deleted_for_all: newMessage.deleted_for_all
            }].slice(-100);
            
            // Auto-scroll if user is at bottom
            requestAnimationFrame(() => {
              if (checkIfAtBottom()) {
                scrollToBottom(true);
              }
            });
            
            return newMessages;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `event_id=eq.${concert.id}`
        },
        (payload) => {
          const updatedMessage = payload.new as any;
          
          setChatMessages(prev => prev.map(msg => 
            msg.id === updatedMessage.id 
              ? { ...msg, deleted_at: updatedMessage.deleted_at, deleted_for_all: updatedMessage.deleted_for_all }
              : msg
          ).filter(msg => {
            // Filter out messages deleted for all, or deleted for this user
            if (msg.deleted_at) {
              if (msg.deleted_for_all) return false;
              if (msg.user_id === user?.id) return false; // Deleted for sender
            }
            return true;
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
          filter: `event_id=eq.${concert.id}`
        },
        (payload) => {
          setChatMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
        }
      )
      .subscribe();

    chatSubscriptionRef.current = channel;
  };

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `chat/${concert.id}/${user?.id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('profiles')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('profiles')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const uploadVoiceNote = async (audioBlob: Blob): Promise<string> => {
    const fileName = `chat/${concert.id}/${user?.id}/voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.webm`;
    
    const { error: uploadError } = await supabase.storage
      .from('profiles')
      .upload(fileName, audioBlob, {
        contentType: 'audio/webm'
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('profiles')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        try {
          const voiceUrl = await uploadVoiceNote(audioBlob);
          await sendChatMessage(null, null, voiceUrl);
        } catch (err: any) {
          console.error('Error uploading voice note:', err);
          setError('Failed to upload voice note.');
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error starting voice recording:', err);
      setError('Failed to start voice recording. Please check microphone permissions.');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const startVideoRecording = async () => {
    if (!localTracks || !isStreaming) {
      setError('Please start streaming before recording.');
      return;
    }

    try {
      // Get the video and audio tracks from localTracks
      const videoTrack = localTracks[1]; // Video track
      const audioTrack = localTracks[0]; // Audio track

      if (!videoTrack || !audioTrack) {
        setError('Video or audio track not available.');
        return;
      }

      // Get MediaStreamTrack from Agora tracks
      let videoMediaTrack: MediaStreamTrack | null = null;
      let audioMediaTrack: MediaStreamTrack | null = null;

      console.log('Attempting to get MediaStreamTrack from Agora tracks:', {
        videoTrackType: typeof videoTrack,
        audioTrackType: typeof audioTrack,
        videoTrackMethods: Object.keys(videoTrack || {}),
        audioTrackMethods: Object.keys(audioTrack || {})
      });

      // Try different methods to get MediaStreamTrack from Agora tracks
      if (videoTrack && typeof (videoTrack as any).getMediaStreamTrack === 'function') {
        videoMediaTrack = (videoTrack as any).getMediaStreamTrack();
        console.log('Got video track via getMediaStreamTrack()');
      } else if (videoTrack && (videoTrack as any)._mediaStreamTrack) {
        videoMediaTrack = (videoTrack as any)._mediaStreamTrack;
        console.log('Got video track via _mediaStreamTrack');
      } else if (videoTrack && (videoTrack as any).getTrack) {
        videoMediaTrack = (videoTrack as any).getTrack();
        console.log('Got video track via getTrack()');
      }

      if (audioTrack && typeof (audioTrack as any).getMediaStreamTrack === 'function') {
        audioMediaTrack = (audioTrack as any).getMediaStreamTrack();
        console.log('Got audio track via getMediaStreamTrack()');
      } else if (audioTrack && (audioTrack as any)._mediaStreamTrack) {
        audioMediaTrack = (audioTrack as any)._mediaStreamTrack;
        console.log('Got audio track via _mediaStreamTrack');
      } else if (audioTrack && (audioTrack as any).getTrack) {
        audioMediaTrack = (audioTrack as any).getTrack();
        console.log('Got audio track via getTrack()');
      }

      if (!videoMediaTrack || !audioMediaTrack) {
        console.error('Failed to get tracks:', {
          videoMediaTrack: !!videoMediaTrack,
          audioMediaTrack: !!audioMediaTrack,
          videoTrack: videoTrack,
          audioTrack: audioTrack
        });
        setError('Unable to access video/audio streams. Please ensure your camera and microphone are properly connected.');
        return;
      }

      console.log('Successfully got tracks:', {
        videoTrackId: videoMediaTrack.id,
        audioTrackId: audioMediaTrack.id,
        videoTrackKind: videoMediaTrack.kind,
        audioTrackKind: audioMediaTrack.kind,
        videoTrackReadyState: videoMediaTrack.readyState,
        audioTrackReadyState: audioMediaTrack.readyState
      });

      // Validate tracks are active
      if (videoMediaTrack.readyState !== 'live' || audioMediaTrack.readyState !== 'live') {
        setError('Video or audio tracks are not active. Please ensure your stream is running.');
        console.error('Track states:', {
          video: videoMediaTrack.readyState,
          audio: audioMediaTrack.readyState
        });
        return;
      }

      // Ensure tracks are enabled
      if (!videoMediaTrack.enabled || !audioMediaTrack.enabled) {
        videoMediaTrack.enabled = true;
        audioMediaTrack.enabled = true;
      }

      // Combine video and audio tracks into a MediaStream
      const combinedStream = new MediaStream([videoMediaTrack, audioMediaTrack]);

      // Validate stream has tracks
      if (combinedStream.getVideoTracks().length === 0 || combinedStream.getAudioTracks().length === 0) {
        setError('Stream does not have both video and audio tracks.');
        console.error('Stream tracks:', {
          video: combinedStream.getVideoTracks().length,
          audio: combinedStream.getAudioTracks().length
        });
        return;
      }

      // Determine supported MIME type
      let mimeType = '';
      const supportedTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4',
        'video/x-matroska;codecs=avc1'
      ];

      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      if (!mimeType) {
        // Fallback to default
        mimeType = '';
        console.warn('No specific MIME type supported, using default');
      }

      console.log('Creating MediaRecorder with:', {
        mimeType,
        videoTracks: combinedStream.getVideoTracks().length,
        audioTracks: combinedStream.getAudioTracks().length,
        videoTrackState: videoMediaTrack.readyState,
        audioTrackState: audioMediaTrack.readyState
      });

      // Create MediaRecorder with error handling
      let recorder: MediaRecorder;
      try {
        const options: MediaRecorderOptions = {
          videoBitsPerSecond: 2500000 // 2.5 Mbps
        };
        
        if (mimeType) {
          options.mimeType = mimeType;
        }

        recorder = new MediaRecorder(combinedStream, options);
      } catch (err: any) {
        console.error('Failed to create MediaRecorder:', err);
        setError(`Failed to create recorder: ${err.message}. Please try a different browser.`);
        return;
      }

      videoRecorderRef.current = recorder;
      videoChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          videoChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Recording error occurred. Please try again.');
        setIsVideoRecording(false);
      };

      recorder.onstop = async () => {
        try {
          const videoBlob = new Blob(videoChunksRef.current, { type: mimeType });
          
          // Create recording record in database
          const { data: recordingData, error: recordingError } = await supabase
            .from('recordings')
            .insert({
              event_id: concert.id,
              artist_id: userProfile?.id,
              title: `${concert.title || 'Live Stream'} - ${new Date().toLocaleDateString()}`,
              description: `Recording of live stream from ${new Date().toLocaleString()}`,
              video_url: '', // Will be updated after upload
              status: 'processing',
              recording_started_at: new Date(Date.now() - recordingDuration * 1000).toISOString(),
              recording_ended_at: new Date().toISOString(),
              duration: recordingDuration,
              file_size: videoBlob.size
            })
            .select()
            .single();

          if (recordingError) throw recordingError;

          // Upload video to Supabase Storage
          const fileName = `recordings/${concert.id}/${recordingData.id}-${Date.now()}.${mimeType.includes('webm') ? 'webm' : 'mp4'}`;
          
          const { error: uploadError } = await supabase.storage
            .from('profiles')
            .upload(fileName, videoBlob, {
              contentType: mimeType,
              upsert: false
            });

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('profiles')
            .getPublicUrl(fileName);

          // Update recording with video URL
          const { error: updateError } = await supabase
            .from('recordings')
            .update({
              video_url: publicUrl,
              status: 'completed'
            })
            .eq('id', recordingData.id);

          if (updateError) throw updateError;

          // Also update event with video URL if it doesn't have one
          await supabase
            .from('events')
            .update({ video_url: publicUrl })
            .eq('id', concert.id)
            .is('video_url', null);

          setSuccess('Recording saved successfully!');
          setTimeout(() => setSuccess(null), 5000);
          setRecordingId(null);
        } catch (err: any) {
          console.error('Error saving recording:', err);
          setError('Failed to save recording. ' + (err.message || ''));
          
          // Update recording status to failed
          if (recordingId) {
            await supabase
              .from('recordings')
              .update({ status: 'failed' })
              .eq('id', recordingId);
          }
        } finally {
          videoChunksRef.current = [];
        }
      };

      recorder.onerror = (event) => {
        console.error('Recording error:', event);
        setError('Recording error occurred.');
        setIsVideoRecording(false);
        setRecordingDuration(0);
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
        }
      };

      // Start recording with error handling
      try {
        // Check recorder state before starting
        if (recorder.state === 'recording') {
          console.warn('Recorder already in recording state');
          recorder.stop();
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Ensure tracks are still active
        if (videoMediaTrack.readyState !== 'live' || audioMediaTrack.readyState !== 'live') {
          throw new Error('Tracks are not active. Please ensure your stream is running.');
        }

        // Validate MediaRecorder is ready
        if (recorder.state !== 'inactive') {
          throw new Error(`Recorder is in ${recorder.state} state, cannot start`);
        }

        // Try to start the recorder
        try {
          recorder.start(1000); // Collect data every second
          console.log('✅ MediaRecorder started successfully');
        } catch (startErr: any) {
          // If starting fails, try with fresh tracks from getUserMedia as fallback
          console.warn('Failed to start with Agora tracks, trying fallback method:', startErr);
          
          try {
            // Request fresh media streams for recording
            const fallbackStream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 }
              },
              audio: {
                deviceId: selectedMicrophoneId ? { exact: selectedMicrophoneId } : undefined,
                echoCancellation: true,
                noiseSuppression: true
              }
            });

            const fallbackRecorder = new MediaRecorder(fallbackStream, {
              mimeType: mimeType || undefined,
              videoBitsPerSecond: 2500000
            });

            fallbackRecorder.ondataavailable = (event) => {
              if (event.data && event.data.size > 0) {
                videoChunksRef.current.push(event.data);
              }
            };

            // Copy other handlers
            fallbackRecorder.onstop = recorder.onstop;
            fallbackRecorder.onerror = recorder.onerror;

            videoRecorderRef.current = fallbackRecorder;
            fallbackRecorder.start(1000);
            console.log('✅ MediaRecorder started with fallback tracks');
          } catch (fallbackErr: any) {
            console.error('Fallback method also failed:', fallbackErr);
            throw new Error(`Failed to start recording: ${startErr.message}. Please check browser compatibility.`);
          }
        }
      } catch (startError: any) {
        console.error('Failed to start MediaRecorder:', startError);
        setError(`Failed to start recording: ${startError.message}. Please ensure your camera and microphone are active and try again.`);
        setIsVideoRecording(false);
        return;
      }

      setIsVideoRecording(true);
      setRecordingDuration(0);
      
      // Create recording record in database
      const { data: recordingData, error: recordingError } = await supabase
        .from('recordings')
        .insert({
          event_id: concert.id,
          artist_id: userProfile?.id,
          title: `${concert.title || 'Live Stream'} - Recording`,
          description: 'Recording in progress...',
          video_url: '',
          status: 'recording',
          recording_started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (recordingError) {
        console.error('Error creating recording record:', recordingError);
        recorder.stop();
        setIsVideoRecording(false);
        return;
      }

      setRecordingId(recordingData.id);

      // Start duration counter
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      setSuccess('Recording started!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error starting video recording:', err);
      setError('Failed to start recording. ' + (err.message || ''));
      setIsVideoRecording(false);
    }
  };

  const stopVideoRecording = async () => {
    if (videoRecorderRef.current && isVideoRecording) {
      videoRecorderRef.current.stop();
      setIsVideoRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (videoRecorderRef.current && isVideoRecording) {
        videoRecorderRef.current.stop();
      }
    };
  }, [isVideoRecording]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const deleteMessage = async (messageId: string, deleteForAll: boolean) => {
    if (!user || !messageId) return;

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('You must be signed in to delete messages.');

      if (deleteForAll) {
        // Hard delete - remove from database
        const { error } = await supabase
          .from('chat_messages')
          .delete()
          .eq('id', messageId)
          .eq('user_id', authUser.id);

        if (error) throw error;
      } else {
        // Soft delete - mark as deleted for sender only
        const { error } = await supabase
          .from('chat_messages')
          .update({
            deleted_at: new Date().toISOString(),
            deleted_for_all: false
          })
          .eq('id', messageId)
          .eq('user_id', authUser.id);

        if (error) throw error;
      }

      // Remove from local state immediately
      setChatMessages(prev => prev.filter(msg => msg.id !== messageId));
    } catch (err: any) {
      console.error('Error deleting message:', err);
      setError(err.message || 'Failed to delete message.');
    }
  };

  const sendChatMessage = async (e: React.FormEvent | null, imageFile?: File | null, voiceUrl?: string) => {
    if (e) e.preventDefault();
    if (!user || !concert.id || !isStreaming) return;
    
    // Must have at least message text, image, or voice
    if (!chatInput.trim() && !imageFile && !selectedImage && !voiceUrl) return;

    try {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authUser) {
        throw new Error('You must be signed in to send messages.');
      }

      let imageUrl: string | undefined;
      let messageType = 'text';
      
      // Upload image if present
      if (imageFile || selectedImage) {
        const fileToUpload = imageFile || selectedImage;
        if (fileToUpload) {
          imageUrl = await uploadImage(fileToUpload);
          messageType = chatInput.trim() ? 'image_text' : 'image';
        }
      }
      
      // Set message type for voice
      if (voiceUrl) {
        messageType = chatInput.trim() ? 'voice_text' : 'voice';
      }

      const messageData: any = {
        event_id: concert.id,
        user_id: authUser.id,
        message: chatInput.trim() || '',
        message_type: messageType,
        reply_to_id: replyingTo?.id || null
      };

      if (imageUrl) messageData.image_url = imageUrl;
      if (voiceUrl) messageData.voice_url = voiceUrl;

      const { data, error } = await supabase
        .from('chat_messages')
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;

      // Immediately add message to chat for instant feedback
      const newMessage = {
        id: data.id,
        user_id: authUser.id,
        username: userProfile?.username || 'You',
        message: chatInput.trim() || (imageUrl ? '📷 Image' : voiceUrl ? '🎤 Voice note' : ''),
        created_at: data.created_at,
        avatar_url: userProfile?.avatar_url,
        reply_to_id: replyingTo?.id,
        reply_to_username: replyingTo?.username,
        image_url: imageUrl,
        voice_url: voiceUrl,
        message_type: messageType
      };

      setChatMessages(prev => [...prev, newMessage].slice(-100));
      
      // Clear inputs
      setChatInput('');
      setReplyingTo(null);
      setSelectedImage(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      // Scroll to bottom
      setTimeout(() => {
        if (chatEndRef.current) {
          chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } catch (err: any) {
      console.error('Error sending chat message:', err);
      setError(err.message || 'Failed to send message.');
    }
  };

  const initializeCamera = async () => {
    if (cameraInitialized || cameraLoading) return;
    setCameraLoading(true);
    setError(null);

    // Validate build-time config (optional)
    const cfg = validateAgoraConfig();
    if (!cfg.isValid) {
      console.warn('Agora config warnings:', cfg.errors);
    }

    try {
      console.log('Initializing camera with:', {
        microphone: selectedMicrophoneId || 'default',
        camera: selectedCameraId || 'default'
      });

      const tracks = await createLocalTracks(
        selectedMicrophoneId, 
        selectedCameraId, 
        { 
          width: 1280, 
          height: 720, 
          frameRate: 30,
          zoom: false, // Disable auto-zoom
          advanced: [
            { zoom: false } // Explicitly disable zoom
          ]
        }
      );
      setLocalTracks(tracks);
      localTracksRef.current = tracks;
      setIsCameraMuted(false);
      setIsMicMuted(false);
      // Store tracks in context for persistence
      setContextTracks(tracks);

      // Play video into container
      if (videoRef.current) {
        try {
          // Ensure the container is ready
          const container = videoRef.current;
          
          // Small delay to ensure DOM is ready
          setTimeout(() => {
            if (container && tracks[1]) {
              tracks[1].play(container);
              console.log('✅ Local video preview started');
              
              // Force video element styling if Agora creates one
              setTimeout(() => {
                const videoElement = container.querySelector('video');
                if (videoElement) {
                  videoElement.style.width = '100%';
                  videoElement.style.height = '100%';
                  videoElement.style.objectFit = 'cover';
                  videoElement.style.display = 'block';
                  console.log('✅ Video element styled');
                } else {
                  console.warn('⚠️ Video element not found in container');
                }
              }, 100);
            }
          }, 50);
        } catch (e) { 
          console.warn('Local video play failed:', e); 
        }
      }

      setCameraInitialized(true);
      setSuccess('Camera initialized successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Camera initialization failed:', err);
      let errorMessage = 'Failed to initialize camera';
      
      if (err.message.includes('Permission denied')) {
        errorMessage = 'Camera/microphone access denied. Please grant permissions and try again.';
      } else if (err.message.includes('NotFoundError')) {
        errorMessage = 'Camera or microphone not found. Please check your devices.';
      } else if (err.message.includes('NotReadableError')) {
        errorMessage = 'Camera is already in use by another application.';
      }
      
      setError(errorMessage);
    } finally {
      setCameraLoading(false);
    }
  };

  const startStream = async () => {
    setError(null);
    if (!client) return setError('Agora client not ready');
    if (!localTracks) return setError('Initialize camera first');

    try {
      // Check client connection state and leave if not disconnected
      const connectionState = client.connectionState;
      console.log('Current client connection state:', connectionState);
      
      if (connectionState !== 'DISCONNECTED') {
        console.log('Client not in DISCONNECTED state, leaving channel first...');
        try {
          await client.leave();
          console.log('✅ Successfully left previous channel');
        } catch (leaveError) {
          console.warn('Error leaving previous channel:', leaveError);
          // Continue anyway as the client might recover
        }
      }

      // Generate a numeric UID for the streamer
      const uid = (crypto.getRandomValues(new Uint32Array(1))[0] % 2147483647) + 1;
      setStreamingUid(uid);

      console.log('Starting stream:', {
        channelName,
        uid,
        role: 'publisher'
      });

      // Generate token with publisher role
      const tokenData = await generateToken(channelName, uid, 'publisher', 3600);
      console.log('Generated token for streaming:', {
        appId: tokenData.appId.substring(0, 8) + '...',
        hasToken: !!tokenData.token
      });

      // Set client role to host before joining
      await client.setClientRole('host');
      console.log('✅ Set client role to host');

      // Join channel and publish
      await joinChannel(client, channelName, tokenData, uid, localTracks);
      console.log('✅ Successfully joined channel and published');

      // Only set streaming state after successful join
      setIsStreaming(true);
      isStreamingRef.current = true;
      setGlobalStreaming(true);
      setGlobalStreamTitle(`${concert.title || 'Live Stream'} - Streaming`);
      setStreamingEventId(concert.id); // Store event ID for persistence
      
      // Store client and tracks in context for persistence
      setContextClient(client);
      setContextTracks(localTracks);
      setContextUid(uid);

      // Register broadcaster session and start heartbeat
      const broadcasterId = userProfile?.id || concert.artistId;
      console.log('🔍 Broadcaster ID check:', {
        userProfileId: userProfile?.id,
        concertArtistId: concert.artistId,
        finalBroadcasterId: broadcasterId
      });

      if (broadcasterId) {
        await registerBroadcasterSession(concert.id, broadcasterId);

        // Start heartbeat to keep session alive
        if (broadcasterHeartbeatRef.current) {
          clearInterval(broadcasterHeartbeatRef.current);
        }
        broadcasterHeartbeatRef.current = startBroadcasterHeartbeat(concert.id, broadcasterId, 30000);
        console.log('✅ Broadcaster session registered and heartbeat started');
      } else {
        console.warn('⚠️ No broadcaster ID available - session not registered');
      }

      // Update stream status in database
      await updateStreamStatus(concert.id, 'live', 0);

      setSuccess('Stream started successfully! You are now live.');
      setTimeout(() => setSuccess(null), 5000);
      
    } catch (err: any) {
      console.error('Start stream error:', err);
      setIsStreaming(false);
      isStreamingRef.current = false;
      setGlobalStreaming(false);
      setStreamingEventId(null); // Clear event ID when stopping
      // Clear client and tracks from context
      setContextClient(null);
      setContextTracks(null);
      setContextUid(null);
      setStreamingUid(null);
      
      let errorMessage = 'Failed to start stream';
      if (err.message.includes('invalid token') || err.message.includes('INVALID_TOKEN')) {
        errorMessage = 'Authentication failed. Please try again.';
      } else if (err.message.includes('CAN_NOT_GET_GATEWAY_SERVER')) {
        errorMessage = 'Cannot connect to streaming server. Please check your internet connection.';
      } else if (err.message.includes('INVALID_APP_ID')) {
        errorMessage = 'Invalid streaming configuration. Please contact support.';
      } else if (err.message.includes('INVALID_OPERATION')) {
        errorMessage = 'Connection state error. Please try again in a moment.';
      }
      
      setError(errorMessage);
    }
  };

  const stopStream = async () => {
    setError(null);
    if (!client) return;

    try {
      console.log('Stopping stream...');

      // Stop broadcaster heartbeat
      if (broadcasterHeartbeatRef.current) {
        clearInterval(broadcasterHeartbeatRef.current);
        broadcasterHeartbeatRef.current = null;
      }

      // Remove broadcaster session (this also updates event status to 'ended')
      const broadcasterId = userProfile?.id || concert.artistId;
      if (broadcasterId) {
        await removeBroadcasterSession(concert.id, broadcasterId);
        console.log('✅ Broadcaster session removed');
      }

      // Leave channel and clean up
      await leaveChannel(client, localTracks);
      console.log('✅ Successfully left channel');

      setIsStreaming(false);
      isStreamingRef.current = false;
      setGlobalStreaming(false);
      setStreamingEventId(null); // Clear event ID when stopping
      // Clear client and tracks from context
      setContextClient(null);
      setContextTracks(null);
      setContextUid(null);
      setStreamingUid(null);
      setViewerCount(0);

      setSuccess('Stream ended successfully.');
      setTimeout(() => setSuccess(null), 3000);

    } catch (err: any) {
      console.error('Stop stream error:', err);
      setError('Failed to stop stream properly. You may need to refresh the page.');
    }
  };

  const restartCamera = async () => {
    setCameraInitialized(false);
    if (localTracks) {
      try {
        localTracks[0].close();
        localTracks[1].close();
      } catch (e) {
        console.warn('Error closing tracks:', e);
      }
      setLocalTracks(null);
      localTracksRef.current = null;
    }
    setIsCameraMuted(false);
    setIsMicMuted(false);

    // Clear video container
    if (videoRef.current) {
      videoRef.current.innerHTML = '';
    }
    
    // Reinitialize
    await initializeCamera();
  };

  const toggleFullscreen = () => {
    const container = fullscreenContainerRef.current;
    if (!container) return;

    if (!isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      } else if ((container as any).msRequestFullscreen) {
        (container as any).msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const full = !!document.fullscreenElement;
      setIsFullscreen(full);
      if (!full) {
        setFullscreenControlsVisible(false);
        if (fullscreenControlsTimeoutRef.current) {
          clearTimeout(fullscreenControlsTimeoutRef.current);
          fullscreenControlsTimeoutRef.current = null;
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div className="bg-gray-900 text-white p-6 rounded-lg">
      <div className="mb-4">
        <h2 className="text-2xl font-bold">Live Streaming Studio</h2>
        <div className="text-gray-400 space-y-1">
          <p>Channel: {channelName}</p>
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-purple-400" />
            <p className="text-lg font-bold text-white">Viewers: {viewerCount}</p>
          </div>
          {streamingUid && <p>Streaming UID: {streamingUid}</p>}
        </div>
      </div>

      {error && (
        <div className="bg-red-600/20 border border-red-600/30 p-3 rounded mb-4">
          <p className="text-red-200">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="bg-green-600/20 border border-green-600/30 p-3 rounded mb-4">
          <p className="text-green-200">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Content Area - Camera Preview with Status Bar on Top */}
        <div className={chatEnabled ? "lg:col-span-8" : "lg:col-span-12"}>
          {/* Stream Status Bar - Modern Design */}
          <div className="bg-gradient-to-r from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 mb-6 shadow-2xl">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6 flex-wrap">
                {/* Status Badge */}
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${isStreaming ? 'bg-red-500 animate-pulse shadow-lg shadow-red-500/50' : 'bg-gray-500'}`}></div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Status</p>
                    <p className={`text-base font-bold ${isStreaming ? 'text-green-400' : 'text-gray-400'}`}>
                      {isStreaming ? 'LIVE' : 'Offline'}
                    </p>
                  </div>
                </div>
                
                {/* Camera Status */}
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    cameraInitialized 
                      ? 'bg-gradient-to-br from-green-500/30 to-emerald-500/30 border border-green-500/50' 
                      : 'bg-gray-700/50 border border-gray-600/50'
                  }`}>
                    <Video className={`h-5 w-5 ${cameraInitialized ? 'text-green-400' : 'text-gray-500'}`} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Camera</p>
                    <p className={`text-base font-bold ${cameraInitialized ? 'text-green-400' : 'text-gray-400'}`}>
                      {cameraInitialized ? 'Ready' : 'Not Ready'}
                    </p>
                  </div>
                </div>
                
                {/* Viewers Count */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-purple-500/50 flex items-center justify-center">
                    <Users className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Viewers</p>
                    <p className="text-base font-bold text-white">{viewerCount}</p>
                  </div>
                </div>
              </div>
              
              {streamingUid && (
                <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Stream ID</p>
                  <p className="text-sm font-mono text-gray-300">{streamingUid}</p>
                </div>
              )}
            </div>
          </div>

          {/* Camera Preview - Fullscreen = whole screen; camera/mic overlay on hover or click only */}
          <div className="bg-gradient-to-br from-gray-900/90 via-gray-800/80 to-gray-900/90 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30 border border-blue-500/50 flex items-center justify-center">
                  <Video className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-xl text-white">Camera Preview</h3>
                  <p className="text-xs text-gray-400">Real-time video feed</p>
                </div>
              </div>
              <button
                onClick={toggleFullscreen}
                className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all duration-300 flex items-center justify-center group"
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? <Minimize2 size={20} className="group-hover:scale-110 transition-transform" /> : <Maximize2 size={20} className="group-hover:scale-110 transition-transform" />}
              </button>
            </div>
            <div
              ref={fullscreenContainerRef}
              className={`studio-fullscreen-container relative ${isFullscreen ? 'fixed inset-0 z-[100] bg-black' : ''}`}
              onMouseEnter={() => { if (isFullscreen) { if (fullscreenControlsTimeoutRef.current) { clearTimeout(fullscreenControlsTimeoutRef.current); fullscreenControlsTimeoutRef.current = null; } setFullscreenControlsVisible(true); } }}
              onMouseLeave={() => { if (isFullscreen) fullscreenControlsTimeoutRef.current = setTimeout(() => setFullscreenControlsVisible(false), 2500); }}
              onClick={() => { if (isFullscreen) setFullscreenControlsVisible((v) => !v); }}
            >
              {/* Video only in fullscreen container - fills whole screen when fullscreen */}
              <div
                ref={videoContainerRef}
                className={`relative bg-black overflow-hidden shadow-2xl group border-2 border-white/10 ${isFullscreen ? 'absolute inset-0 w-full h-full' : 'w-full max-w-4xl mx-auto rounded-2xl'}`}
                style={isFullscreen ? {} : { aspectRatio: '16/9', minHeight: '450px' }}
              >
                {!isFullscreen && isStreaming && (
                  <div className="absolute -inset-1 bg-gradient-to-r from-red-600 via-pink-600 to-red-600 rounded-2xl opacity-20 blur-xl animate-pulse -z-10"></div>
                )}
                <div ref={videoRef} className="w-full h-full agora-video-player" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }} />
                {!cameraInitialized && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                    <div className="text-center text-gray-400">
                      <p className="text-xl mb-2 font-semibold">Camera Preview</p>
                      <p className="text-sm">Click "Start Camera" to begin</p>
                    </div>
                  </div>
                )}
                {cameraInitialized && !localTracks && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                    <div className="text-center text-gray-400">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                      <p className="text-sm">Loading camera feed...</p>
                    </div>
                  </div>
                )}
              </div>
              {/* Fullscreen overlay: Camera + Mic + Exit — visible on hover or click only */}
              {isFullscreen && cameraInitialized && localTracks && (
                <div
                  className={`absolute bottom-0 left-0 right-0 z-50 flex items-center justify-center p-4 bg-gradient-to-t from-black/90 via-black/70 to-transparent transition-opacity duration-300 ${fullscreenControlsVisible ? 'opacity-100' : 'opacity-0'}`}
                  style={{ pointerEvents: fullscreenControlsVisible ? 'auto' : 'none' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-black/60 backdrop-blur-md border border-white/20 shadow-xl">
                    <button type="button" onClick={toggleCameraMute} title={isCameraMuted ? 'Unmute camera' : 'Mute camera'}
                      className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${isCameraMuted ? 'bg-red-500/30 text-red-300 border border-red-500/50 hover:bg-red-500/40' : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'}`}>
                      {isCameraMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5 text-emerald-400" />}
                      <span>{isCameraMuted ? 'Camera off' : 'Camera on'}</span>
                    </button>
                    <button type="button" onClick={toggleMicMute} title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                      className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${isMicMuted ? 'bg-red-500/30 text-red-300 border border-red-500/50 hover:bg-red-500/40' : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'}`}>
                      {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-emerald-400" />}
                      <span>{isMicMuted ? 'Mic off' : 'Mic on'}</span>
                    </button>
                    <div className="w-px h-8 bg-white/20" />
                    <button type="button" onClick={toggleFullscreen} className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-semibold text-sm bg-white/10 text-white border border-white/20 hover:bg-white/20" title="Exit fullscreen">
                      <Minimize2 className="w-5 h-5" />
                      <span>Exit</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mute Camera / Mute Mic - Desktop only when NOT in fullscreen (in fullscreen use overlay) */}
            {!isFullscreen && cameraInitialized && localTracks && (
              <div className="hidden lg:flex flex-wrap items-center justify-center gap-3 mt-4">
                <div className="flex items-center gap-2 px-1 py-1 rounded-2xl bg-gray-800/80 backdrop-blur-sm border border-white/10 shadow-lg">
                  <button
                    type="button"
                    onClick={toggleCameraMute}
                    title={isCameraMuted ? 'Unmute camera' : 'Mute camera'}
                    className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 ${
                      isCameraMuted
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 hover:border-red-500/50'
                        : 'bg-white/5 text-gray-200 border border-white/10 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    {isCameraMuted ? (
                      <VideoOff className="w-5 h-5" />
                    ) : (
                      <Video className="w-5 h-5 text-emerald-400" />
                    )}
                    <span>{isCameraMuted ? 'Camera off' : 'Camera on'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleMicMute}
                    title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                    className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 ${
                      isMicMuted
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 hover:border-red-500/50'
                        : 'bg-white/5 text-gray-200 border border-white/10 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    {isMicMuted ? (
                      <MicOff className="w-5 h-5" />
                    ) : (
                      <Mic className="w-5 h-5 text-emerald-400" />
                    )}
                    <span>{isMicMuted ? 'Mic off' : 'Mic on'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Control Buttons - Modern Design */}
            <div className="flex flex-wrap gap-3 mt-6 justify-center">
              <button 
                onClick={initializeCamera} 
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl transition-all duration-300 font-bold text-sm shadow-lg hover:shadow-purple-500/50 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none" 
                disabled={cameraLoading || cameraInitialized}
              >
                {cameraLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span> Starting...
                  </span>
                ) : cameraInitialized ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Camera Ready
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Video className="w-4 h-4" /> Start Camera
                  </span>
                )}
              </button>

              {cameraInitialized && (
                <button 
                  onClick={restartCamera} 
                  className="px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 rounded-xl transition-all duration-300 font-bold text-sm shadow-lg border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={cameraLoading || isStreaming}
                >
                  Restart Camera
                </button>
              )}

              {!isStreaming ? (
                <button 
                  onClick={startStream} 
                  className="px-8 py-3 bg-gradient-to-r from-green-600 via-emerald-600 to-green-600 hover:from-green-700 hover:via-emerald-700 hover:to-green-700 rounded-xl transition-all duration-300 font-bold text-base shadow-2xl hover:shadow-green-500/50 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2" 
                  disabled={!cameraInitialized || cameraLoading}
                >
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  Go Live
                </button>
              ) : (
                <>
                  <button 
                    onClick={stopStream} 
                    className="px-8 py-3 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-700 hover:via-rose-700 hover:to-red-700 rounded-xl transition-all duration-300 font-bold text-base shadow-2xl hover:shadow-red-500/50 transform hover:scale-105"
                  >
                    End Stream
                  </button>
                  
                  {recordingEnabled && (
                    !isVideoRecording ? (
                      <button 
                        onClick={startVideoRecording} 
                        className="px-6 py-3 bg-gradient-to-r from-orange-600 via-red-600 to-orange-600 hover:from-orange-700 hover:via-red-700 hover:to-orange-700 rounded-xl transition-all duration-300 font-bold text-sm shadow-2xl hover:shadow-orange-500/50 transform hover:scale-105 flex items-center gap-2"
                        title="Start recording this stream"
                      >
                        <Circle className="w-4 h-4" />
                        Record
                      </button>
                    ) : (
                      <button 
                        onClick={stopVideoRecording} 
                        className="px-6 py-3 bg-gradient-to-r from-red-700 via-rose-700 to-red-700 hover:from-red-800 hover:via-rose-800 hover:to-red-800 rounded-xl transition-all duration-300 font-bold text-sm shadow-2xl hover:shadow-red-500/50 transform hover:scale-105 flex items-center gap-2 animate-pulse"
                        title="Stop recording"
                      >
                        <Square className="w-4 h-4 fill-white" />
                        Stop Recording
                        <span className="ml-2 text-xs">({Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')})</span>
                      </button>
                    )
                  )}
                </>
              )}
            </div>
            
            {/* Camera Selector */}
            <div className="mt-4">
              <CameraSelector
                onCameraChange={(id: string) => {
                  setSelectedCameraId(id);
                  if (cameraInitialized) {
                    setSuccess('Camera device changed. Click "Restart Camera" to apply changes.');
                    setTimeout(() => setSuccess(null), 5000);
                  }
                }}
                selectedDeviceId={selectedCameraId}
              />
            </div>
          </div>

          {/* Camera Statistics - Modern Design */}
          {cameraInitialized && localTracks && (
            <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl p-6 rounded-2xl border border-white/10 shadow-xl mt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/30 to-cyan-500/30 border border-blue-500/50 flex items-center justify-center">
                  <BarChart className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="font-bold text-lg text-white">Camera Statistics</h3>
              </div>
              <CameraStats stream={localTracks[1]?.getMediaStream?.() || null} />
            </div>
          )}
        </div>

        {/* Right Sidebar - Chat Panel - Modern Design */}
        {chatEnabled && (
          <div className="lg:col-span-4">
            {/* Chat Panel - Enhanced with Glassmorphism */}
            <div className="bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl rounded-3xl overflow-hidden flex flex-col h-[calc(100vh-280px)] max-h-[800px] border border-white/10 shadow-2xl">
            {/* Chat Header - Enhanced */}
            <div className="flex items-center justify-between p-5 border-b border-white/10 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-purple-600/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-purple-500/50 flex items-center justify-center">
                    <MessageCircle className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">Live Chat</h3>
                    <p className="text-xs text-gray-400">{chatMessages.length} messages</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowChat(!showChat)}
                  className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all duration-300 flex items-center justify-center group"
                >
                  <X size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                </button>
            </div>

            {/* Chat Messages */}
            {showChat && (
              <>
                <div 
                  ref={chatContainerRef}
                  onScroll={handleChatScroll}
                  className="flex-1 overflow-y-auto p-4 space-y-3"
                  style={{ 
                    scrollBehavior: 'smooth',
                    WebkitOverflowScrolling: 'touch',
                    overscrollBehavior: 'contain'
                  }}
                >
                    {!isStreaming ? (
                      <div className="text-center py-12 px-4">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
                          <MessageCircle className="h-10 w-10 text-purple-400 opacity-60" />
                        </div>
                        <p className="text-base font-semibold text-gray-300 mb-1">Start Streaming</p>
                        <p className="text-sm text-gray-500">Chat messages will appear here when you go live</p>
                      </div>
                    ) : chatMessages.length === 0 ? (
                      <div className="text-center py-12 px-4">
                        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
                          <MessageCircle className="h-10 w-10 text-blue-400 opacity-60" />
                        </div>
                        <p className="text-base font-semibold text-gray-300 mb-1">No Messages Yet</p>
                        <p className="text-sm text-gray-500">Waiting for viewers to start chatting...</p>
                      </div>
                    ) : (
                      chatMessages.map((msg) => {
                        const isOwnMessage = msg.user_id === user?.id;
                        const isDeleted = msg.deleted_at && (msg.deleted_for_all || isOwnMessage);
                        
                        if (isDeleted) {
                          return (
                            <div key={msg.id} className="flex items-center justify-center py-2">
                              <p className="text-xs text-gray-500 italic">Message deleted</p>
                            </div>
                          );
                        }

                        return (
                          <div key={msg.id} className={`flex items-start space-x-2 ${isOwnMessage ? 'bg-purple-900/20 rounded p-2' : ''}`}>
                            {msg.avatar_url ? (
                              <img
                                src={msg.avatar_url}
                                alt={msg.username}
                                className="w-8 h-8 rounded-full flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-xs font-semibold">
                                  {msg.username.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className={`text-sm font-semibold ${isOwnMessage ? 'text-purple-300' : 'text-white'}`}>
                                  {msg.username} {isOwnMessage && '(You)'}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {new Date(msg.created_at).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                                {!isOwnMessage && (
                                  <button
                                    onClick={() => setReplyingTo({ id: msg.id, username: msg.username, message: msg.message })}
                                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center space-x-1"
                                  >
                                    <Reply size={12} />
                                    <span>Reply</span>
                                  </button>
                                )}
                                {isOwnMessage && (
                                  <button
                                    onClick={() => {
                                      if (confirm('Delete for everyone or just for you?')) {
                                        const deleteForAll = confirm('Delete for everyone? (Cancel for just you)');
                                        deleteMessage(msg.id, deleteForAll);
                                      }
                                    }}
                                    className="text-xs text-red-400 hover:text-red-300"
                                    title="Delete message"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                              {msg.reply_to_username && (
                                <div className="text-xs text-gray-500 italic mb-1 border-l-2 border-purple-500 pl-2">
                                  Replying to {msg.reply_to_username}: "{msg.reply_to_message?.substring(0, 50)}{msg.reply_to_message && msg.reply_to_message.length > 50 ? '...' : ''}"
                                </div>
                              )}
                              {msg.image_url && (
                                <img
                                  src={msg.image_url}
                                  alt="Chat image"
                                  className="max-w-full rounded-lg mb-2 cursor-pointer"
                                  onClick={() => window.open(msg.image_url, '_blank')}
                                />
                              )}
                              {msg.voice_url && (
                                <div className="mb-2">
                                  <audio controls className="w-full h-8">
                                    <source src={msg.voice_url} type="audio/webm" />
                                    Your browser does not support audio playback.
                                  </audio>
                                </div>
                              )}
                              {msg.message && (
                                <p className="text-sm text-gray-300 break-words">{msg.message}</p>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Chat Input - Only show when streaming */}
                  {isStreaming && user ? (
                    <div className="p-4 border-t border-gray-700">
                      {replyingTo && (
                        <div className="mb-2 p-2 bg-purple-900/30 rounded flex items-center justify-between">
                          <div className="text-xs text-purple-300">
                            Replying to <span className="font-semibold">{replyingTo.username}</span>: "{replyingTo.message.substring(0, 40)}{replyingTo.message.length > 40 ? '...' : ''}"
                          </div>
                          <button
                            onClick={() => setReplyingTo(null)}
                            className="text-purple-400 hover:text-purple-300"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                      {imagePreview && (
                        <div className="mb-2 relative">
                          <img src={imagePreview} alt="Preview" className="max-w-xs rounded-lg" />
                          <button
                            onClick={() => {
                              setImagePreview(null);
                              setSelectedImage(null);
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                      <form onSubmit={(e) => sendChatMessage(e, selectedImage)} className="space-y-2">
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder={replyingTo ? `Reply to ${replyingTo.username}...` : "Reply to viewers..."}
                            className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                            maxLength={500}
                          />
                          <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            onChange={handleImageSelect}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                            title="Upload image"
                          >
                            <Image size={18} />
                          </button>
                          <button
                            type="button"
                            onMouseDown={startVoiceRecording}
                            onMouseUp={stopVoiceRecording}
                            onTouchStart={startVoiceRecording}
                            onTouchEnd={stopVoiceRecording}
                            className={`px-3 py-2 rounded-lg transition-colors ${
                              isRecording 
                                ? 'bg-red-600 hover:bg-red-700 animate-pulse' 
                                : 'bg-gray-600 hover:bg-gray-700'
                            } text-white`}
                            title="Hold to record voice note"
                          >
                            <Mic size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className="bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                            title="Add emoji"
                          >
                            <Smile size={18} />
                          </button>
                          <button
                            type="submit"
                            disabled={!chatInput.trim() && !selectedImage && !imagePreview}
                            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Send size={18} />
                          </button>
                        </div>
                        {showEmojiPicker && (
                          <div className="bg-gray-800 rounded-lg p-3 grid grid-cols-8 gap-2 max-h-32 overflow-y-auto">
                            {['😀', '😂', '😍', '🥰', '😎', '🤔', '👍', '❤️', '🔥', '💯', '🎉', '🙌', '👏', '😊', '😢', '😮', '😱', '🤗', '😴', '🤤', '😋', '😏', '😌', '😇'].map(emoji => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  setChatInput(prev => prev + emoji);
                                  setShowEmojiPicker(false);
                                }}
                                className="text-2xl hover:scale-125 transition-transform"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </form>
                    </div>
                  ) : isStreaming && !user ? (
                    <div className="p-4 border-t border-gray-700 bg-gray-700/50 text-center">
                      <p className="text-gray-400 text-sm">Sign in to reply to chat</p>
                    </div>
                  ) : null}
                </>
              )}
          </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default AgoraStreamingStudio;