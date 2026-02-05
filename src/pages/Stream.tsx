import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import StreamingStudio from '../components/StreamingStudio';
import { Lock } from 'lucide-react';

const Stream: React.FC = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const streamKey = searchParams.get('key');
  
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isValidKey, setIsValidKey] = useState(false);

  useEffect(() => {
    validateStreamKey();
  }, [id, streamKey]);

  const validateStreamKey = async () => {
    if (!id || !streamKey) {
      setError('Invalid streaming link');
      setLoading(false);
      return;
    }

    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .eq('stream_key', streamKey)
        .single();

      if (eventError) throw eventError;
      
      if (!eventData) {
        setError('Invalid stream key');
        setLoading(false);
        return;
      }

      setEvent(eventData);
      setIsValidKey(true);
    } catch (err) {
      console.error('Error validating stream key:', err);
      setError('Failed to validate stream key');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error || !isValidKey) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-gray-800 p-8 rounded-lg max-w-md w-full text-center">
          <Lock className="h-16 w-16 text-red-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
          <p className="text-gray-400">
            {error || 'You do not have permission to access this stream'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 pt-16 px-4">
      <div className="container mx-auto py-8">
        <StreamingStudio
          concert={{
            id: event.id,
            artistId: event.artist_id,
            title: event.title,
            date: event.start_time,
            time: new Date(event.start_time).toLocaleTimeString(),
            imageUrl: event.image_url,
            description: event.description,
            categories: ['Music'],
            duration: event.duration,
            isLive: event.status === 'live',
            price: event.price,
            maxTickets: 1000,
            soldTickets: 0,
            streamUrl: event.stream_url
          }}
        />
      </div>
    </div>
  );
};

export default Stream; 