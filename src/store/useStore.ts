import { create } from 'zustand';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { StreamSession } from '../types';
import { logAuthEvent } from '../utils/authLogger';

interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  user_type: 'fan' | 'artist' | 'global_admin' | 'super_admin';
  bio?: string;
  email?: string;
  phone?: string;
  notification_preference?: string;
}

interface Store {
  user: User | null;
  userProfile: Profile | null;
  currentStream: StreamSession | null;
  initialized: boolean;
  setUser: (user: User | null) => void;
  setUserProfile: (profile: Profile | null) => void;
  setCurrentStream: (stream: StreamSession | null) => void;
  setInitialized: (value: boolean) => void;
  signOut: () => Promise<void>;
}

export const useStore = create<Store>((set) => ({
  user: null,
  userProfile: null,
  currentStream: null,
  initialized: false,
  setUser: (user) => set({ user }),
  setUserProfile: (profile) => set({ userProfile: profile }),
  setCurrentStream: (stream) => set({ currentStream: stream }),
  setInitialized: (value) => set({ initialized: value }),
  signOut: async () => {
    const currentUser = useStore.getState().user;
    const currentProfile = useStore.getState().userProfile;
    
    // Log logout before signing out
    if (currentUser && currentProfile) {
      await logAuthEvent({
        email: currentUser.email || '',
        action: 'logout',
        success: true,
        userId: currentUser.id,
        metadata: {
          user_type: currentProfile.user_type || 'unknown'
        }
      });
    }
    
    await supabase.auth.signOut();
    set({ user: null, userProfile: null, currentStream: null });
  },
}));