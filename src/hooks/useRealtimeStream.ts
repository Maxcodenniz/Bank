import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

interface StreamData {
  viewerCount: number;
  status: 'offline' | 'connecting' | 'live' | 'ended';
  streamUrl: string | null;
  messages: ChatMessage[];
}

interface ChatMessage {
  id: string;
  user: string;
  message: string;
  timestamp: Date;
}

export const useRealtimeStream = (eventId: string) => {
  const [streamData, setStreamData] = useState<StreamData>({
    viewerCount: 0,
    status: 'offline',
    streamUrl: null,
    messages: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial stream data
  const fetchStreamData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('status, viewer_count, stream_url')
        .eq('id', eventId)
        .single();

      if (error) throw error;

      setStreamData(prev => ({
        ...prev,
        viewerCount: data.viewer_count || 0,
        status: data.status === 'live' ? 'live' : 'offline',
        streamUrl: data.stream_url
      }));
    } catch (err) {
      setError('Failed to fetch stream data');
      console.error('Error fetching stream data:', err);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // Set up real-time subscriptions
  useEffect(() => {
    fetchStreamData();

    // Subscribe to event changes
    const eventSubscription = supabase
      .channel(`event-${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'events',
          filter: `id=eq.${eventId}`
        },
        (payload) => {
          const newData = payload.new as any;
          setStreamData(prev => ({
            ...prev,
            viewerCount: newData.viewer_count || 0,
            status: newData.status === 'live' ? 'live' : 'offline',
            streamUrl: newData.stream_url
          }));
        }
      )
      .subscribe();

    return () => {
      eventSubscription.unsubscribe();
    };
  }, [eventId, fetchStreamData]);

  // Send chat message
  const sendMessage = useCallback(async (message: string, userName: string) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      user: userName,
      message: message.trim(),
      timestamp: new Date()
    };

    setStreamData(prev => ({
      ...prev,
      messages: [...prev.messages.slice(-99), newMessage] // Keep last 100 messages
    }));

    // In a real implementation, you'd send this to your chat service
    // For now, we'll just store it locally
  }, []);

  // Simulate viewer join/leave
  const updateViewerCount = useCallback(async (increment: boolean) => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('viewer_count')
        .eq('id', eventId)
        .single();

      if (error) throw error;

      const currentCount = data.viewer_count || 0;
      const newCount = Math.max(0, currentCount + (increment ? 1 : -1));

      await supabase
        .from('events')
        .update({ viewer_count: newCount })
        .eq('id', eventId);

    } catch (err) {
      console.error('Error updating viewer count:', err);
    }
  }, [eventId]);

  return {
    streamData,
    loading,
    error,
    sendMessage,
    updateViewerCount,
    refetch: fetchStreamData
  };
};