import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabaseClient';
import { Trash2, Search, User, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SUPER_ADMIN_ID } from '../utils/constants';

interface UserPhoto {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  cover_url: string;
  profile_photo: string;
  user_type: string;
}

const PhotoManagement: React.FC = () => {
  const { userProfile } = useStore();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Allow any super_admin, not just the protected one
    if (!userProfile || userProfile?.user_type !== 'super_admin') {
      navigate('/');
      return;
    }
    fetchUsers();
  }, [userProfile, navigate]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, cover_url, profile_photo, user_type')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      setError('Failed to fetch users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deletePhoto = async (userId: string, photoType: 'avatar' | 'cover' | 'profile', photoUrl: string) => {
    try {
      setError(null);
      setSuccess(null);

      if (!photoUrl) {
        setError('No photo to delete');
        return;
      }

      const bucket = 'profiles';
      const path = photoUrl.split(`${bucket}/`)[1];

      if (path) {
        const { error: deleteError } = await supabase.storage
          .from(bucket)
          .remove([path]);

        if (deleteError) throw deleteError;
      }

      const updateField = photoType === 'avatar' ? 'avatar_url' : photoType === 'cover' ? 'cover_url' : 'profile_photo';

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ [updateField]: null })
        .eq('id', userId);

      if (updateError) throw updateError;

      setSuccess(`${photoType.charAt(0).toUpperCase() + photoType.slice(1)} photo deleted successfully`);
      fetchUsers();
    } catch (err) {
      setError(`Failed to delete ${photoType} photo`);
      console.error(err);
    }
  };

  const updateUserPhoto = async (userId: string, photoType: 'avatar' | 'cover' | 'profile', file: File) => {
    try {
      setError(null);
      setSuccess(null);

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const folderName = photoType === 'avatar' ? 'avatars' : 'covers';
      const filePath = `${folderName}/${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      const updateField = photoType === 'avatar' ? 'avatar_url' : photoType === 'cover' ? 'cover_url' : 'profile_photo';

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ [updateField]: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      setSuccess(`${photoType.charAt(0).toUpperCase() + photoType.slice(1)} photo updated successfully`);
      fetchUsers();
    } catch (err) {
      setError(`Failed to update ${photoType} photo`);
      console.error(err);
    }
  };

  const filteredUsers = users.filter(user =>
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto px-6 py-8 pt-24">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">Photo Management</h1>
        <button
          onClick={fetchUsers}
          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <RefreshCw size={20} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-500 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500 bg-opacity-10 border border-green-500 text-green-500 px-4 py-3 rounded-lg mb-4">
          {success}
        </div>
      )}

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by username or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredUsers.map((user) => (
            <div key={user.id} className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.username} className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                      <User size={32} className="text-gray-400" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">{user.username}</h3>
                    <p className="text-gray-400">{user.full_name}</p>
                    <span className={`inline-block mt-1 px-2 py-1 rounded text-xs ${
                      user.user_type === 'super_admin' ? 'bg-red-500/20 text-red-400' :
                      user.user_type === 'admin' ? 'bg-yellow-500/20 text-yellow-400' :
                      user.user_type === 'artist' ? 'bg-purple-500/20 text-purple-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {user.user_type}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">Avatar Photo</label>
                  {user.avatar_url ? (
                    <div className="space-y-2">
                      <img src={user.avatar_url} alt="Avatar" className="w-full h-40 object-cover rounded-lg" />
                      <button
                        onClick={() => deletePhoto(user.id, 'avatar', user.avatar_url)}
                        className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                      >
                        <Trash2 size={16} />
                        <span>Delete Avatar</span>
                      </button>
                    </div>
                  ) : (
                    <div className="w-full h-40 bg-gray-700 rounded-lg flex items-center justify-center">
                      <ImageIcon className="text-gray-500" size={40} />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) updateUserPhoto(user.id, 'avatar', file);
                    }}
                    className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">Cover Photo</label>
                  {user.cover_url ? (
                    <div className="space-y-2">
                      <img src={user.cover_url} alt="Cover" className="w-full h-40 object-cover rounded-lg" />
                      <button
                        onClick={() => deletePhoto(user.id, 'cover', user.cover_url)}
                        className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                      >
                        <Trash2 size={16} />
                        <span>Delete Cover</span>
                      </button>
                    </div>
                  ) : (
                    <div className="w-full h-40 bg-gray-700 rounded-lg flex items-center justify-center">
                      <ImageIcon className="text-gray-500" size={40} />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) updateUserPhoto(user.id, 'cover', file);
                    }}
                    className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">Profile Photo</label>
                  {user.profile_photo ? (
                    <div className="space-y-2">
                      <img src={user.profile_photo} alt="Profile" className="w-full h-40 object-cover rounded-lg" />
                      <button
                        onClick={() => deletePhoto(user.id, 'profile', user.profile_photo)}
                        className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                      >
                        <Trash2 size={16} />
                        <span>Delete Profile</span>
                      </button>
                    </div>
                  ) : (
                    <div className="w-full h-40 bg-gray-700 rounded-lg flex items-center justify-center">
                      <ImageIcon className="text-gray-500" size={40} />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) updateUserPhoto(user.id, 'profile', file);
                    }}
                    className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PhotoManagement;
