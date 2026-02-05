import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../store/useStore';
import { Calendar, Clock, Users, Image, Euro, Info, Pencil, Trash2, Upload, X, Search, Link as LinkIcon, Lock } from 'lucide-react';
import { formatDate } from '../utils/formatters';
import { v4 as uuidv4 } from 'uuid';
import heic2any from 'heic2any';

const isHeicFile = (file: File): boolean =>
  file.type === 'image/heic' || file.type === 'image/heif' || /\.(heic|heif)$/i.test(file.name);

const Schedule: React.FC = () => {
  const { userProfile } = useStore();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [artists, setArtists] = useState<any[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<any>(null);
  const [showArtistDropdown, setShowArtistDropdown] = useState(false);
  const [artistSearch, setArtistSearch] = useState('');
  const [isUnregisteredArtist, setIsUnregisteredArtist] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamLink, setStreamLink] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '',
    startDate: '',
    startTimeOnly: '12:00',
    duration: 60,
    price: 1.99,
    imageUrl: '',
    artistName: '',
    artistEmail: '',
    artistType: 'music'
  });

  useEffect(() => {
    fetchEvents();
    const isAdmin = userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin';
    if (isAdmin) {
      fetchArtists();
    }
  }, [userProfile]);

  // Effect to ensure price is always 1.99 for non-admin users
  useEffect(() => {
    if (userProfile?.user_type !== 'global_admin' && userProfile?.user_type !== 'super_admin') {
      setFormData(prev => ({ ...prev, price: 1.99 }));
    }
  }, [userProfile]);

  // Generate time options in 15-minute intervals
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        const displayTime = `${String(hour % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
        options.push({ value: timeString, label: displayTime });
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  // Combine date and time into ISO string
  const combineDateTime = (date: string, time: string): string => {
    if (!date || !time) return '';
    const [hours, minutes] = time.split(':');
    const dateTime = new Date(date);
    dateTime.setHours(parseInt(hours, 10));
    dateTime.setMinutes(parseInt(minutes, 10));
    dateTime.setSeconds(0);
    dateTime.setMilliseconds(0);
    
    // Format as ISO string for datetime-local input
    const year = dateTime.getFullYear();
    const month = String(dateTime.getMonth() + 1).padStart(2, '0');
    const day = String(dateTime.getDate()).padStart(2, '0');
    const hoursStr = String(dateTime.getHours()).padStart(2, '0');
    const minutesStr = String(dateTime.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hoursStr}:${minutesStr}`;
  };

  // Update startTime when date or time changes
  useEffect(() => {
    if (formData.startDate && formData.startTimeOnly) {
      const combined = combineDateTime(formData.startDate, formData.startTimeOnly);
      setFormData(prev => ({ ...prev, startTime: combined }));
    }
  }, [formData.startDate, formData.startTimeOnly]);

  const fetchArtists = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_type', 'artist');

      if (error) throw error;
      setArtists(data || []);
    } catch (error) {
      console.error('Error fetching artists:', error);
    }
  };

  const filteredArtists = artistSearch
    ? artists.filter(artist => 
        artist.full_name.toLowerCase().includes(artistSearch.toLowerCase()) ||
        artist.username.toLowerCase().includes(artistSearch.toLowerCase())
      )
    : artists;

  const getEventStatus = (startTime: string, duration: number) => {
    const now = new Date();
    const eventStart = new Date(startTime);
    const eventEnd = new Date(eventStart.getTime() + duration * 60000);

    if (now < eventStart) return 'upcoming';
    if (now >= eventStart && now <= eventEnd) return 'live';
    return 'ended';
  };

  const fetchEvents = async () => {
    try {
      if (!userProfile) return;

      const query = supabase
        .from('events')
        .select('*')
        .order('start_time', { ascending: true });

      if (userProfile.user_type !== 'global_admin') {
        query.eq('artist_id', userProfile.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      const updatedEvents = await Promise.all((data || []).map(async (event) => {
        const currentStatus = getEventStatus(event.start_time, event.duration);
        
        if (currentStatus !== event.status) {
          const { error: updateError } = await supabase
            .from('events')
            .update({ status: currentStatus })
            .eq('id', event.id);

          if (updateError) throw updateError;
          return { ...event, status: currentStatus };
        }
        
        return event;
      }));

      setEvents(updatedEvents);
      setFailedImageUrls(new Set());
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedImage = file.type.startsWith('image/') || isHeicFile(file);
    if (!allowedImage) {
      setError('Please select an image file (JPEG, PNG, HEIC, etc.)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }

    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }

    if (isHeicFile(file)) {
      try {
        const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
        const blob = Array.isArray(result) ? result[0] : result;
        const url = URL.createObjectURL(blob);
        previewObjectUrlRef.current = url;
        setPreviewUrl(url);
        setError(null);
      } catch (err) {
        console.error('HEIC conversion failed:', err);
        setError('Could not process HEIC image. Try converting to JPEG on your device first.');
      }
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadEventImage = async (file: File): Promise<string> => {
    let fileToUpload: File = file;
    if (isHeicFile(file)) {
      try {
        const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
        const blob = Array.isArray(result) ? result[0] : result;
        const baseName = file.name.replace(/\.(heic|heif)$/i, '');
        fileToUpload = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
      } catch (err) {
        console.error('HEIC conversion failed:', err);
        throw new Error('Could not convert HEIC image. Try converting to JPEG first.');
      }
    }

    const rawExt = fileToUpload.name.split('.').pop()?.toLowerCase()?.replace(/[^a-z0-9]/g, '') || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${rawExt}`;
    const filePath = `events/${userProfile?.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('profiles')
      .upload(filePath, fileToUpload, {
        upsert: true,
        contentType: fileToUpload.type || 'image/jpeg',
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('profiles')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const validateForm = () => {
    const now = new Date();
    const eventDate = new Date(formData.startTime);
    
    if (eventDate <= now) {
      setError('Event start time must be in the future');
      return false;
    }

    const isAdmin = userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin';
    if (isAdmin) {
      if (!selectedArtist && !isUnregisteredArtist) {
        setError('Please select an artist or create an unregistered artist');
        return false;
      }

      if (isUnregisteredArtist) {
        if (!formData.artistName.trim()) {
          setError('Artist name is required');
          return false;
        }
        if (!formData.artistEmail.trim()) {
          setError('Artist email is required');
          return false;
        }
        if (!formData.artistEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
          setError('Please enter a valid email address');
          return false;
        }
      }

      if (formData.price < 0.01) {
        setError('Minimum price is €0.01');
        return false;
      }
    } else {
      if (formData.price !== 1.99) {
        setError('Price is fixed at €1.99 for artist events');
        return false;
      }
    }

    if (!editingEvent) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const eventsInLastYear = events.filter(event => {
        const eventDate = new Date(event.start_time);
        return eventDate >= oneYearAgo && event.status !== 'ended';
      });

      if (eventsInLastYear.length >= 12) {
        setError('You can only schedule up to 12 events per year');
        return false;
      }
    }
    
    if (userProfile?.user_type !== 'global_admin') {
      const maxDuration = userProfile?.artist_type === 'music' ? 45 : 30;
      if (formData.duration > maxDuration) {
        setError(`Maximum duration for ${userProfile?.artist_type} events is ${maxDuration} minutes`);
        return false;
      }
    }
    
    return true;
  };

  const generateStreamKey = () => {
    return uuidv4();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    
    setError(null);
    setStreamLink(null);
    setSaveSuccess(false);
    if (!validateForm()) return;

    try {
      setLoading(true);
      
      let imageUrl = formData.imageUrl;
      let artistId = userProfile.id;
      let streamKey = null;

      if (fileInputRef.current?.files?.[0]) {
        imageUrl = await uploadEventImage(fileInputRef.current.files[0]);
      }

      const isAdmin = userProfile.user_type === 'global_admin' || userProfile.user_type === 'super_admin';
      if (isAdmin) {
        if (isUnregisteredArtist) {
          streamKey = generateStreamKey();
          artistId = null;
        } else {
          artistId = selectedArtist.id;
        }
      }

      const finalPrice = isAdmin ? formData.price : 1.99;

      const eventData = {
        title: formData.title,
        description: formData.description,
        artist_id: artistId,
        start_time: formData.startTime,
        duration: formData.duration,
        price: finalPrice,
        image_url: imageUrl,
        status: 'upcoming',
        stream_key: streamKey,
        unregistered_artist_name: isUnregisteredArtist ? formData.artistName : null,
        unregistered_artist_email: isUnregisteredArtist ? formData.artistEmail : null,
        artist_type: isUnregisteredArtist ? formData.artistType : null
      };

      if (editingEvent) {
        const { error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', editingEvent);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('events')
          .insert(eventData)
          .select()
          .single();

        if (error) throw error;

        if (streamKey) {
          const streamUrl = `${window.location.origin}/stream/${data.id}?key=${streamKey}`;
          setStreamLink(streamUrl);

          try {
            const { error: emailError } = await supabase.functions.invoke('send-event-email', {
              body: {
                email: formData.artistEmail,
                eventTitle: formData.title,
                streamUrl,
                startTime: formData.startTime,
                duration: formData.duration
              }
            });

            if (emailError) {
              console.error('Error sending email:', emailError);
              setError(`Email notification could not be sent: ${emailError.message}`);
            }
          } catch (emailError) {
            console.error('Error invoking email function:', emailError);
            setError('Failed to send email notification, but event was created successfully');
          }
        }

        // Send phone notifications for event scheduled (only if artistId exists)
        console.log('📱 Checking if phone notifications should be sent...', { artistId, isUnregisteredArtist });
        
        if (artistId) {
          try {
            // Get artist name
            let artistName = 'Artist';
            if (isAdmin && selectedArtist) {
              artistName = selectedArtist.full_name || selectedArtist.username || 'Artist';
            } else if (userProfile) {
              artistName = userProfile.full_name || userProfile.username || 'Artist';
            }

            console.log('📱 About to call send-phone-notifications with:', {
              eventId: data.id,
              eventTitle: formData.title,
              artistId: artistId,
              artistName: artistName,
              notificationType: 'event_scheduled'
            });

            const { data: phoneData, error: phoneError } = await supabase.functions.invoke('send-phone-notifications', {
              body: {
                eventId: data.id,
                eventTitle: formData.title,
                artistId: artistId,
                artistName: artistName,
                notificationType: 'event_scheduled'
              }
            });

            console.log('📱 Phone notification response:', { phoneData, phoneError });

            if (phoneError) {
              console.error('❌ Error sending phone notifications:', phoneError);
              // Don't show error to user, just log it
            } else {
              console.log('✅ Phone notifications triggered for event scheduled:', phoneData);
            }
          } catch (phoneError) {
            console.error('❌ Error invoking phone notification function:', phoneError);
            // Don't show error to user, just log it
          }
        } else {
          console.log('📱 ⚠️ Skipping phone notifications - artistId is null/undefined');
        }
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      setFormData({
        title: '',
        description: '',
        startTime: '',
        startDate: '',
        startTimeOnly: '12:00',
        duration: 60,
        price: 1.99,
        imageUrl: '',
        artistName: '',
        artistEmail: '',
        artistType: 'music'
      });
      setPreviewUrl(null);
      setSelectedArtist(null);
      setIsUnregisteredArtist(false);

      await fetchEvents();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save event';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (event: any) => {
    setEditingEvent(event.id);
    const eventDate = new Date(event.start_time);
    const dateStr = eventDate.toISOString().split('T')[0];
    const hours = String(eventDate.getHours()).padStart(2, '0');
    // Round minutes to nearest 15-minute interval
    const minutes = String(Math.round(eventDate.getMinutes() / 15) * 15).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;
    
    // Set date and time separately - useEffect will combine them into startTime
    setFormData({
      title: event.title,
      description: event.description,
      startTime: '', // Will be set by useEffect
      startDate: dateStr,
      startTimeOnly: timeStr,
      duration: event.duration,
      price: (userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin') ? event.price : 1.99,
      imageUrl: event.image_url,
      artistName: event.unregistered_artist_name || '',
      artistEmail: event.unregistered_artist_email || '',
      artistType: event.artist_type || 'music'
    });
    setPreviewUrl(event.image_url);
    
    const isAdmin = userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin';
    if (isAdmin) {
      if (event.artist_id) {
        const artist = artists.find(a => a.id === event.artist_id);
        setSelectedArtist(artist);
        setIsUnregisteredArtist(false);
      } else {
        setSelectedArtist(null);
        setIsUnregisteredArtist(true);
      }
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;
      await fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      setError('Failed to delete event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clearPreview = () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    setPreviewUrl(null);
    setFormData({ ...formData, imageUrl: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getRemainingEvents = () => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const eventsInLastYear = events.filter(event => {
      const eventDate = new Date(event.start_time);
      return eventDate >= oneYearAgo && event.status !== 'ended';
    });

    return 12 - eventsInLastYear.length;
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isAdmin = userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin';
    if (isAdmin) {
      setFormData({ ...formData, price: parseFloat(e.target.value) || 0 });
    } else {
      // For artists, always keep price at 1.99
      setFormData({ ...formData, price: 1.99 });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      
      <div className="container mx-auto px-6 py-8 pt-24 relative z-10">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
            {editingEvent ? 'Edit Event' : 'Schedule Event'}
          </h1>
          {!editingEvent && userProfile?.user_type !== 'global_admin' && (
            <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-xl px-6 py-3 rounded-2xl border border-purple-500/30 shadow-xl">
              <span className="text-gray-300">
                Events remaining this year: <span className="text-purple-400 font-bold text-lg">{getRemainingEvents()}</span>
              </span>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Schedule Form */}
          <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl p-8 rounded-3xl border border-white/10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-gradient-to-r from-red-600/20 via-red-500/20 to-red-600/20 backdrop-blur-sm border-2 border-red-500/50 text-red-300 px-6 py-4 rounded-2xl shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <p className="font-semibold">{error}</p>
                </div>
              </div>
            )}

            {streamLink && (
              <div className="bg-gradient-to-r from-green-600/20 via-emerald-500/20 to-green-600/20 backdrop-blur-sm border-2 border-green-500/50 text-green-300 px-6 py-4 rounded-2xl shadow-xl">
                <p className="mb-2">Event created successfully! Share this link with the artist:</p>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={streamLink}
                    readOnly
                    className="flex-1 bg-green-500 bg-opacity-20 px-3 py-1 rounded"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(streamLink);
                      alert('Link copied to clipboard!');
                    }}
                    className="p-2 hover:text-green-400"
                  >
                    <LinkIcon size={20} />
                  </button>
                </div>
              </div>
            )}

            {/* Artist Selection for Admin */}
            {(userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin') && (
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUnregisteredArtist(false);
                      setFormData({
                        ...formData,
                        artistName: '',
                        artistEmail: '',
                        artistType: 'music'
                      });
                    }}
                    className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                      !isUnregisteredArtist
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Registered Artist
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUnregisteredArtist(true);
                      setSelectedArtist(null);
                    }}
                    className={`flex-1 py-2 px-4 rounded-lg transition-colors ${
                      isUnregisteredArtist
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    New Artist
                  </button>
                </div>

                {isUnregisteredArtist ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-gray-300 mb-2">Artist Name</label>
                      <input
                        type="text"
                        value={formData.artistName}
                        onChange={(e) => setFormData({ ...formData, artistName: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-gray-300 mb-2">Artist Email</label>
                      <input
                        type="email"
                        value={formData.artistEmail}
                        onChange={(e) => setFormData({ ...formData, artistEmail: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-gray-300 mb-2">Artist Type</label>
                      <select
                        value={formData.artistType}
                        onChange={(e) => setFormData({ ...formData, artistType: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="music">Music</option>
                        <option value="comedy">Comedy</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-gray-300 mb-2">Select Artist</label>
                    <div className="relative">
                      <div
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white cursor-pointer flex justify-between items-center"
                        onClick={() => setShowArtistDropdown(!showArtistDropdown)}
                      >
                        <span>{selectedArtist ? selectedArtist.full_name : 'Select an artist'}</span>
                        <Search className="h-4 w-4 text-gray-400" />
                      </div>
                      
                      {showArtistDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg">
                          <input
                            type="text"
                            value={artistSearch}
                            onChange={(e) => setArtistSearch(e.target.value)}
                            className="w-full px-4 py-2 bg-gray-600 text-white border-b border-gray-500 rounded-t-lg focus:outline-none"
                            placeholder="Search artists..."
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="max-h-48 overflow-y-auto">
                            {filteredArtists.map((artist) => (
                              <div
                                key={artist.id}
                                className="px-4 py-2 hover:bg-gray-600 cursor-pointer text-white flex items-center space-x-2"
                                onClick={() => {
                                  setSelectedArtist(artist);
                                  setShowArtistDropdown(false);
                                }}
                              >
                                <span>{artist.full_name}</span>
                                <span className="text-sm text-gray-400">({artist.artist_type})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Image Upload */}
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                {previewUrl ? (
                  <div className="relative">
                    <img
                      src={previewUrl}
                      alt="Event preview"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={clearPreview}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div
                    className="w-full h-48 rounded-xl border-2 border-dashed border-gray-600 bg-gradient-to-br from-gray-800/80 to-gray-800/40 flex flex-col items-center justify-center gap-3 transition-colors hover:border-purple-500/50 hover:from-purple-900/20 hover:to-gray-800/40 cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                  >
                    <div className="w-14 h-14 rounded-xl bg-gray-700/80 flex items-center justify-center ring-1 ring-gray-600/50">
                      <Image size={28} className="text-purple-400/80" />
                    </div>
                    <span className="text-sm text-gray-400">Click or use the button below</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,.heic,.heif"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <Upload size={20} />
                  <span>Upload Event Image</span>
                </button>
              </div>
            </div>
            
            <div>
              <label className="block text-gray-300 mb-2">Event Title</label>
              <div className="relative">
                <Info className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  required
                  placeholder="Enter event title"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                rows={4}
                required
                placeholder="Describe your event"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 mb-2">Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    required
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-300 mb-2">Time (15-min intervals)</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <select
                    value={formData.startTimeOnly}
                    onChange={(e) => setFormData({ ...formData, startTimeOnly: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
                    required
                  >
                    {timeOptions.map((option) => (
                      <option key={option.value} value={option.value} className="bg-gray-700">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-gray-300 mb-2">
                Duration (minutes)
                {userProfile?.user_type !== 'global_admin' && (
                  <span className="text-sm text-gray-400 ml-2">
                    Max: {userProfile?.artist_type === 'music' ? '45' : '30'} minutes
                  </span>
                )}
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  min={1}
                  max={(userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin') ? undefined : userProfile?.artist_type === 'music' ? 45 : 30}
                  required
                />
              </div>
            </div>

            {/* Price Field */}
            <div>
              <label className="block text-gray-300 mb-2 flex items-center">
                Price (€)
                {userProfile?.user_type !== 'global_admin' && (
                  <div className="flex items-center ml-2">
                    <Lock size={16} className="text-gray-400 mr-1" />
                    <span className="text-sm text-gray-400">Fixed at €1.99</span>
                  </div>
                )}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 font-semibold" style={{ fontSize: '18px' }}>€</span>
                <input
                  type="number"
                  value={formData.price}
                  onChange={handlePriceChange}
                  className={`w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500 ${
                    userProfile?.user_type !== 'global_admin' ? 'cursor-not-allowed opacity-75' : ''
                  }`}
                  min={(userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin') ? "0.01" : "1.99"}
                  max={(userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin') ? undefined : "1.99"}
                  step="0.01"
                  readOnly={userProfile?.user_type !== 'global_admin'}
                  required
                />
                {userProfile?.user_type !== 'global_admin' && (
                  <Lock className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                )}
              </div>
              {userProfile?.user_type !== 'global_admin' && (
                <p className="text-sm text-gray-400 mt-1">
                  All artist events have a standard price of €1.99
                </p>
              )}
            </div>

            <div className="flex space-x-4">
              {editingEvent && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingEvent(null);
                    setFormData({
                      title: '',
                      description: '',
                      startTime: '',
                      startDate: '',
                      startTimeOnly: '12:00',
                      duration: 60,
                      price: 1.99,
                      imageUrl: '',
                      artistName: '',
                      artistEmail: '',
                      artistType: 'music'
                    });
                    setPreviewUrl(null);
                    setSelectedArtist(null);
                    setIsUnregisteredArtist(false);
                  }}
                  className="flex-1 bg-gray-700 text-white py-3 rounded-lg font-semibold transition-colors hover:bg-gray-600"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className={`flex-1 py-3 rounded-lg font-semibold transition-all duration-300 ${
                  loading 
                    ? 'bg-gray-600 cursor-not-allowed opacity-50' 
                    : saveSuccess
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-purple-600 hover:bg-purple-700'
                } text-white`}
              >
                {loading 
                  ? 'Saving...' 
                  : saveSuccess 
                    ? 'Saved!' 
                    : editingEvent 
                      ? 'Update Event' 
                      : 'Schedule Event'}
              </button>
            </div>
          </form>
        </div>

        {/* Scheduled Events */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-6">
            {(userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin') ? 'All Scheduled Events' : 'Your Scheduled Events'}
          </h2>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
              <p className="text-gray-400 mt-4">Loading events...</p>
            </div>
          ) : events.length > 0 ? (
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="bg-gray-800 p-6 rounded-lg hover:bg-gray-700 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-white">{event.title}</h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(event)}
                        className="p-2 text-gray-400 hover:text-purple-400 transition-colors"
                        title="Edit event"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(event.id)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                        title="Delete event"
                      >
                        <Trash2 size={18} />
                      </button>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        event.status === 'upcoming' ? 'bg-purple-500 text-white' :
                        event.status === 'live' ? 'bg-red-500 text-white' :
                        'bg-gray-500 text-white'
                      }`}>
                        {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4 mb-4">
                    {failedImageUrls.has(event.image_url) ? (
                      <div className="w-24 h-24 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0" title="Image unavailable">
                        <Image className="h-8 w-8 text-gray-500" />
                      </div>
                    ) : (
                      <img
                        src={event.image_url}
                        alt={event.title}
                        className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
                        style={{ objectPosition: 'center top' }}
                        onError={() => setFailedImageUrls(prev => new Set(prev).add(event.image_url))}
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-gray-400 mb-2">{event.description}</p>
                      {(userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin') && (
                        <div className="text-sm text-gray-500">
                          {event.unregistered_artist_name ? (
                            <span>Artist: {event.unregistered_artist_name} (Unregistered)</span>
                          ) : (
                            <span>Artist ID: {event.artist_id}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center text-gray-400">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span>{formatDate(event.start_time)}</span>
                    </div>
                    <div className="flex items-center text-gray-400">
                      <Clock className="h-4 w-4 mr-2" />
                      <span>{event.duration} minutes</span>
                    </div>
                    <div className="flex items-center text-gray-400">
                      <span className="mr-2">€</span>
                      <span>€{event.price.toFixed(2)}</span>
                      {event.price === 1.99 && userProfile?.user_type !== 'global_admin' && (
                        <Lock className="h-3 w-3 ml-1 text-gray-500" />
                      )}
                    </div>
                    <div className="flex items-center text-gray-400">
                      <Users className="h-4 w-4 mr-2" />
                      <span>{event.viewer_count || 0} viewers</span>
                    </div>
                  </div>

                  {event.stream_key && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Streaming Link:</span>
                        <button
                          onClick={() => {
                            const link = `${window.location.origin}/stream/${event.id}?key=${event.stream_key}`;
                            navigator.clipboard.writeText(link);
                            alert('Link copied to clipboard!');
                          }}
                          className="flex items-center space-x-2 text-purple-400 hover:text-purple-300"
                        >
                          <LinkIcon size={16} />
                          <span>Copy Link</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-800 rounded-lg">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400">No events scheduled yet.</p>
              <p className="text-gray-500 text-sm mt-2">
                {(userProfile?.user_type === 'global_admin' || userProfile?.user_type === 'super_admin') 
                  ? 'Create events for artists to get started.' 
                  : 'Schedule your first event to start streaming!'}
              </p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default Schedule;