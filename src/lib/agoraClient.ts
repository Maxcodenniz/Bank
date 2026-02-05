// src/lib/agoraClient.ts

import AgoraRTC, {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  ICameraVideoTrack,
  ILocalVideoTrack,
  ILocalAudioTrack
} from 'agora-rtc-sdk-ng';
import { supabase } from './supabaseClient';

export type LocalTracks = [IMicrophoneAudioTrack | ILocalAudioTrack, ICameraVideoTrack | ILocalVideoTrack];

export function createClient(opts?: { mode?: 'live' | 'rtc'; codec?: 'vp8' | 'h264' }) {
  const client = AgoraRTC.createClient({ 
    mode: (opts?.mode ?? 'live') as any, 
    codec: opts?.codec ?? 'vp8' 
  });
  
  console.log('Created Agora client with:', {
    mode: opts?.mode ?? 'live',
    codec: opts?.codec ?? 'vp8'
  });
  
  return client;
}

export async function createLocalTracks(microphoneId?: string, cameraId?: string, encoderConfig?: any) {
  try {
    console.log('Creating local tracks with:', {
      microphoneId: microphoneId || 'default',
      cameraId: cameraId || 'default',
      encoderConfig
    });

    // Pass device ids into Agora so it uses the selected devices
    const audioConfig: any = microphoneId ? { microphoneId } : true;
    
    // Build video config with proper constraints to prevent auto-zoom
    const videoConfig: any = {};
    
    if (cameraId) {
      videoConfig.cameraId = cameraId;
    }
    
    // Merge encoderConfig (which may contain constraints) with default anti-zoom settings
    if (encoderConfig) {
      // If encoderConfig has constraints, merge them
      if (encoderConfig.width || encoderConfig.height || encoderConfig.frameRate || encoderConfig.zoom || encoderConfig.advanced) {
        videoConfig.encoderConfig = encoderConfig;
      } else {
        // Otherwise, encoderConfig might be the constraints object itself
        Object.assign(videoConfig, encoderConfig);
      }
    }
    
    // Ensure zoom is disabled if not already set
    if (!videoConfig.zoom && !videoConfig.encoderConfig?.zoom) {
      videoConfig.zoom = { min: 1.0, max: 1.0 };
    }
    
    // If no video config specified, use default
    if (Object.keys(videoConfig).length === 0) {
      videoConfig.encoderConfig = {
        width: { exact: 720 },
        height: { exact: 1280 },
        frameRate: { ideal: 30 },
        zoom: { min: 1.0, max: 1.0 }
      };
    }
    
    const tracks = await AgoraRTC.createMicrophoneAndCameraTracks(audioConfig, videoConfig);
    console.log('✅ Successfully created local tracks');
    
    return tracks as LocalTracks;
  } catch (error) {
    console.error('❌ Failed to create local tracks:', error);
    throw error;
  }
}

export async function generateToken(channelName: string, uid: number | string, role = 'publisher', expireTime = 3600) {
  console.log('Generating token for:', {
    channelName,
    uid,
    role,
    expireTime
  });

  try {
    // Try Supabase functions.invoke first
    try {
      if ((supabase as any)?.functions?.invoke) {
        console.log('Using Supabase functions.invoke...');
        const res = await (supabase as any).functions.invoke('generate-agora-token', {
          body: { channelName, uid, role, expireTime }
        });
        
        if (res.error) {
          console.error('Supabase function error:', res.error);
          throw new Error(`Supabase function error: ${res.error.message || res.error}`);
        }
        
        if (res.data && res.data.token && res.data.appId) {
          console.log('✅ Token generated via Supabase functions');
          return res.data as { token: string; appId: string };
        } else {
          throw new Error('Invalid response from token service');
        }
      }
    } catch (supabaseErr) {
      console.warn('Supabase functions.invoke failed:', supabaseErr);
      // Continue to fallback
    }
  } catch (err) {
    console.warn('Supabase functions.invoke unavailable or failed:', err);
  }

  // Fallback to direct fetch
  console.log('Falling back to direct fetch...');
  try {
    // Trim whitespace and newlines from environment variables
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
    
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL not configured');
    }
    
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-agora-token`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey || ''}`
      },
      body: JSON.stringify({ channelName, uid, role, expireTime }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      console.error('Token service error:', payload);
      throw new Error(payload?.error || `Token service returned ${response.status}`);
    }

    const tokenData = await response.json();
    
    if (tokenData && tokenData.token && tokenData.appId) {
      console.log('✅ Token generated via direct fetch');
      return tokenData as { token: string; appId: string };
    } else {
      throw new Error('Invalid token data received from service');
    }
  } catch (error) {
    console.error('❌ Token generation failed:', error);
    
    // Final fallback - return appId only for testing
    const envAppId = import.meta.env.VITE_AGORA_APP_ID;
    if (envAppId) {
      console.warn('Using environment appId without token as final fallback');
      return { token: '', appId: envAppId };
    }
    
    throw new Error(`Token generation completely failed: ${error.message}`);
  }
}

export async function joinChannel(
  client: IAgoraRTCClient,
  channelName: string,
  tokenOrTokenData: string | { token: string; appId: string },
  uid: number | string,
  localTracks?: LocalTracks
) {
  let token: string;
  let appId: string | undefined;

  if (typeof tokenOrTokenData === 'string') {
    token = tokenOrTokenData;
    // Try to read appId from build-time env (Vite) as a fallback
    appId = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_AGORA_APP_ID) || undefined;
  } else {
    token = tokenOrTokenData.token;
    appId = tokenOrTokenData.appId;
  }

  if (!appId) {
    const error = 'Agora App ID not provided. Ensure generateToken returns appId or set VITE_AGORA_APP_ID.';
    console.error('❌', error);
    throw new Error(error);
  }

  try {
    console.log('Joining channel:', {
      channelName,
      appId: appId.substring(0, 8) + '...',
      hasToken: !!token,
      uid,
      hasLocalTracks: !!localTracks
    });

    // Join the channel
    await client.join(appId, channelName, token, uid as any);
    console.log('✅ Successfully joined channel');

    // Publish local tracks if provided (for streamers)
    if (localTracks) {
      try {
        console.log('Publishing local tracks...');
        await client.publish(localTracks);
        console.log('✅ Successfully published local tracks');
      } catch (publishError) {
        console.error('❌ Publish failed:', publishError);
        // Not fatal — the client is still joined and can try to publish later
        throw new Error('Failed to publish audio/video. Please try again.');
      }
    }
  } catch (error) {
    console.error('❌ Join channel failed:', error);
    throw error;
  }
}

export async function leaveChannel(client: IAgoraRTCClient, localTracks?: LocalTracks) {
  try {
    console.log('Leaving channel...');
    
    if (localTracks) {
      try { 
        console.log('Unpublishing local tracks...');
        await client.unpublish(localTracks); 
        console.log('✅ Unpublished local tracks');
      } catch (e) { 
        console.warn('Unpublish warning:', e);
      }
      
      try { 
        console.log('Closing local tracks...');
        localTracks[0].close(); 
        localTracks[1].close(); 
        console.log('✅ Closed local tracks');
      } catch (e) { 
        console.warn('Close tracks warning:', e);
      }
    }
  } catch (err) {
    console.warn('Error cleaning up local tracks:', err);
  }

  try {
    await client.leave();
    console.log('✅ Successfully left channel');
  } catch (err) {
    console.error('❌ Error leaving channel:', err);
    throw err;
  }
}

export async function updateStreamStatus(eventId: string | number, status: 'live' | 'ended' | 'scheduled', viewer_count?: number) {
  try {
    console.log('Updating stream status:', {
      eventId,
      status,
      viewer_count
    });

    const updatePayload: any = { status };
    if (typeof viewer_count === 'number') updatePayload.viewer_count = viewer_count;
    
    const { error } = await supabase
      .from('events')
      .update(updatePayload)
      .eq('id', eventId);
      
    if (error) {
      console.error('Supabase update error:', error);
      throw error;
    }
    
    console.log('✅ Stream status updated successfully');

    // Send notifications and emails when stream goes live
    if (status === 'live') {
      try {
        // Get event and artist details for notifications
        const { data: event, error: eventError } = await supabase
          .from('events')
          .select(`
            id,
            title,
            artist_id,
            profiles:artist_id (
              full_name,
              username,
              id
            )
          `)
          .eq('id', eventId)
          .single();

        if (!eventError && event) {
          const eventTitle = event.title || 'Live Stream';
          const artistName = (event.profiles as any)?.full_name || 
                           (event.profiles as any)?.username || 
                           'Artist';
          
          console.log('📢 Stream went live, triggering notifications and emails...', {
            eventId: event.id,
            eventTitle,
            artistName
          });

          // Call edge functions via Supabase Functions
          // Get the Supabase project URL from the current client
          const projectUrl = supabase.supabaseUrl;
          
          if (projectUrl) {
            // Call notification function
            try {
              const { data: notifData, error: notifError } = await supabase.functions.invoke('send-live-event-notifications', {
                body: {
                  eventId: event.id,
                  eventTitle,
                  artistName,
                }
              });

              if (notifError) {
                console.error('❌ Failed to send notifications:', notifError);
              } else {
                console.log('✅ Live event notifications triggered:', notifData);
              }
            } catch (notifErr) {
              console.error('❌ Error calling notifications function:', notifErr);
            }

            // Call email function
            try {
              const { data: emailData, error: emailError } = await supabase.functions.invoke('send-live-event-emails', {
                body: {
                  eventId: event.id,
                  eventTitle,
                  artistName,
                }
              });

              if (emailError) {
                console.error('❌ Failed to send emails:', emailError);
              } else {
                console.log('✅ Live event emails triggered:', emailData);
              }
            } catch (emailErr) {
              console.error('❌ Error calling emails function:', emailErr);
            }

            // Call phone notification function
            console.log('📱 Checking if phone notifications should be sent for live event...', { artistId: event.artist_id });
            
            if (event.artist_id) {
              try {
                console.log('📱 About to call send-phone-notifications with:', {
                  eventId: event.id,
                  eventTitle,
                  artistId: event.artist_id,
                  artistName,
                  notificationType: 'live_event_started'
                });

                const { data: phoneData, error: phoneError } = await supabase.functions.invoke('send-phone-notifications', {
                  body: {
                    eventId: event.id,
                    eventTitle,
                    artistId: event.artist_id,
                    artistName,
                    notificationType: 'live_event_started'
                  }
                });

                console.log('📱 Phone notification response:', { phoneData, phoneError });

                if (phoneError) {
                  console.error('❌ Failed to send phone notifications:', phoneError);
                } else {
                  console.log('✅ Phone notifications triggered:', phoneData);
                }
              } catch (phoneErr) {
                console.error('❌ Error calling phone notification function:', phoneErr);
              }
            } else {
              console.log('📱 ⚠️ Skipping phone notifications - event.artist_id is null/undefined');
            }
          }
        } else {
          console.error('❌ Failed to fetch event details for notifications:', eventError);
        }
      } catch (notifError) {
        // Don't fail the stream update if notifications fail
        console.error('❌ Error triggering live stream notifications:', notifError);
      }
    }
  } catch (err) {
    console.error('❌ Failed to update stream status in Supabase:', err);
    // Don't throw here as this is not critical for streaming functionality
  }
}

export function validateAgoraConfig() {
  const errors: string[] = [];
  const envAny = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};

  const appId = envAny?.VITE_AGORA_APP_ID || undefined;
  if (!appId) {
    errors.push('VITE_AGORA_APP_ID not found in client build environment.');
  } else {
    console.log('Found VITE_AGORA_APP_ID:', appId.substring(0, 8) + '...');
  }

  return { 
    isValid: errors.length === 0, 
    errors, 
    appId 
  } as const;
}