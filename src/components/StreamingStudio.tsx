import React from 'react';
import { useStore } from '../store/useStore';
import { Concert } from '../types';
import ModernStreamingStudio from './ModernStreamingStudio';

interface StreamingStudioProps {
  concert: Concert;
}

const StreamingStudio: React.FC<StreamingStudioProps> = ({ concert }) => {
  const { userProfile } = useStore();

  if (!userProfile || !['artist', 'global_admin', 'super_admin'].includes(userProfile.user_type)) {
    return (
      <div className="bg-gray-900 text-white p-6 rounded-lg text-center">
        <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
        <p className="text-gray-400">You don't have permission to access the streaming studio.</p>
      </div>
    );
  }

  return <ModernStreamingStudio concert={concert} />;
};

export default StreamingStudio;
