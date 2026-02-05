import { supabase } from '../lib/supabaseClient';

export interface LiveStreamNotificationData {
  eventId: string;
  eventTitle: string;
  artistName: string;
  artistId: string;
}

/**
 * Send live stream notifications to users based on their type and enabled configs
 */
export async function sendLiveStreamNotifications(data: LiveStreamNotificationData) {
  try {
    console.log('🔔 Starting to send live stream notifications:', data);
    
    // Check notification configs
    const { data: configs, error: configError } = await supabase
      .from('app_config')
      .select('key, value')
      .in('key', [
        'live_notifications_fans_enabled',
        'live_notifications_artists_enabled',
        'live_notifications_admins_enabled'
      ]);

    if (configError) {
      console.error('❌ Error fetching notification configs:', configError);
      return;
    }
    
    console.log('📋 Notification configs:', configs);

    // Parse configs
    const configMap: Record<string, boolean> = {
      live_notifications_fans_enabled: true,
      live_notifications_artists_enabled: true,
      live_notifications_admins_enabled: true
    };

    configs?.forEach((item: { key: string; value: any }) => {
      const isEnabled = item.value === true || item.value === 'true';
      configMap[item.key] = isEnabled;
    });
    
    console.log('📊 Config map:', configMap);

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, user_type, full_name, email');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return;
    }

    if (!users || users.length === 0) {
      console.log('⚠️ No users found to notify');
      return;
    }
    
    console.log(`👥 Found ${users.length} total users`);

    // Filter users based on enabled configs and user type
    const usersToNotify = users.filter((user: { id: string; user_type: string }) => {
      if (user.id === data.artistId) return false; // Don't notify the artist themselves
      
      switch (user.user_type) {
        case 'fan':
          return configMap.live_notifications_fans_enabled;
        case 'artist':
          return configMap.live_notifications_artists_enabled;
        case 'global_admin':
        case 'super_admin':
          return configMap.live_notifications_admins_enabled;
        default:
          return false;
      }
    });

    if (usersToNotify.length === 0) {
      console.log('⚠️ No users to notify based on configs');
      return;
    }
    
    console.log(`📤 Preparing to notify ${usersToNotify.length} users:`, usersToNotify.map((u: { id: string; user_type: string }) => ({ id: u.id, type: u.user_type })));

    // Create notifications in the database
    const notifications = usersToNotify.map((user: { id: string }) => ({
      user_id: user.id,
      title: `${data.artistName} is now live!`,
      message: `${data.artistName} has started streaming "${data.eventTitle}". Watch now!`,
      type: 'info',
      read: false,
      metadata: {
        eventId: data.eventId,
        eventTitle: data.eventTitle,
        artistName: data.artistName,
        artistId: data.artistId,
        notificationType: 'live_stream_started'
      }
    }));

    // Insert notifications using the database function (bypasses RLS)
    // This allows creating notifications for any user
    let successCount = 0;
    let errorCount = 0;
    
    for (const notification of notifications) {
      try {
        const { data, error: rpcError } = await supabase.rpc('insert_notification_for_user', {
          target_user_id: notification.user_id,
          notification_title: notification.title,
          notification_message: notification.message,
          notification_type: notification.type,
          notification_metadata: notification.metadata
        });

        if (rpcError) {
          console.error(`Error inserting notification for user ${notification.user_id}:`, rpcError);
          errorCount++;
          
          // Fallback to direct insert if RPC fails (may fail due to RLS)
          try {
            const { error: insertError } = await supabase
              .from('notifications')
              .insert(notification);
            if (insertError) {
              console.error(`Fallback insert also failed for user ${notification.user_id}:`, insertError);
            } else {
              console.log(`✅ Fallback insert succeeded for user ${notification.user_id}`);
              successCount++;
            }
          } catch (fallbackErr) {
            console.error(`Fallback insert error for user ${notification.user_id}:`, fallbackErr);
          }
        } else {
          console.log(`✅ Notification inserted for user ${notification.user_id}`, data);
          successCount++;
        }
      } catch (err) {
        console.error(`Error calling insert_notification_for_user for user ${notification.user_id}:`, err);
        errorCount++;
      }
    }

    console.log(`✅ Notification insertion complete: ${successCount} succeeded, ${errorCount} failed out of ${notifications.length} total`);

  } catch (error) {
    console.error('Error sending live stream notifications:', error);
  }
}

/**
 * Request browser notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    console.log('Notification permission denied');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

