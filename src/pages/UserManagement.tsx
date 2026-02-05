import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useStore } from '../store/useStore';
import { User, Clock, UserX, Shield, ShieldAlert, AlertCircle, Crown, Mail, Calendar, Search, Filter, RefreshCw, TrendingUp } from 'lucide-react';
import { SUPER_ADMIN_ID, isSuperAdmin } from '../utils/constants';

interface UserData {
  id: string;
  full_name: string;
  email: string;
  user_type: string;
  created_at: string;
}

const UserManagement: React.FC = () => {
  const { userProfile } = useStore();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Join with auth.users to get email
      let query = supabase
        .from('profiles')
        .select('id, full_name, user_type, created_at, email')
        .order('created_at', { ascending: false });

      // Hide super admins from non-super-admin users
      // Only super admins can see other super admins
      if (!isSuperAdmin(userProfile?.id, userProfile?.user_type)) {
        // Filter out super admins for regular admins
        query = query.neq('user_type', 'super_admin');
      }

      const { data: profiles, error: profilesError } = await query;

      if (profilesError) throw profilesError;
      setUsers(profiles || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserType = async (userId: string, newType: string) => {
    try {
      setError(null);

      // Prevent changing protected super admin's user type
      const targetUser = users.find(u => u.id === userId);
      if (userId === SUPER_ADMIN_ID) {
        setError("Cannot modify the protected super admin's role");
        return;
      }

      // Prevent changing own user type
      if (userId === userProfile?.id) {
        setError("You cannot change your own user type");
        return;
      }

      // Only Super Admins can change roles - this should never be reached for global_admin
      // since the dropdown is hidden, but adding as a safety check
      if (!isSuperAdmin(userProfile?.id, userProfile?.user_type)) {
        setError("Only super admins can change user roles");
        return;
      }

      console.log('🔄 Updating user type:', { userId, newType, currentUser: userProfile?.id, currentUserType: userProfile?.user_type });
      
      // Only Super Admins can change roles - use RPC function
      const { error: rpcError } = await supabase.rpc('update_user_type', {
        target_user_id: userId,
        new_user_type: newType
      });

      if (rpcError) {
        console.error('❌ RPC error details:', {
          message: rpcError.message,
          details: rpcError.details,
          hint: rpcError.hint,
          code: rpcError.code
        });
        throw rpcError;
      }

      console.log('✅ Update successful via RPC');

      await fetchUsers();
    } catch (err) {
      console.error('Error updating user type:', err);
      setError(err instanceof Error ? err.message : 'Failed to update user type');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      setError(null);

      // Prevent deleting protected super admin
      if (userId === SUPER_ADMIN_ID) {
        setError("Cannot delete the protected super admin account");
        return;
      }

      // Prevent deleting own account
      if (userId === userProfile?.id) {
        setError("You cannot delete your own account");
        return;
      }

      // Only super admin can delete other admins
      if (!isSuperAdmin(userProfile?.id, userProfile?.user_type)) {
        const targetUser = users.find(u => u.id === userId);
        if (targetUser?.user_type === 'global_admin') {
          setError("Only the super admin can delete other admins");
          return;
        }
      }

      if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
      }

      // Call the edge function to delete user with admin privileges
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("You must be logged in to perform this action");
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user-admin`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user');
      }

      await fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  // Filter users based on search and type
  const filteredUsers = users.filter(user => {
    // Hide super admins from non-super-admin users (double check)
    if (!isSuperAdmin(userProfile?.id, userProfile?.user_type) && (user.user_type === 'super_admin' || isSuperAdmin(user.id, user.user_type))) {
      return false;
    }
    
    const matchesSearch = !searchQuery || 
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Handle filter type - for super_admin filter, show users with user_type = 'super_admin' OR protected super admin
    let matchesType = false;
    if (filterType === 'all') {
      matchesType = true;
    } else if (filterType === 'super_admin') {
      matchesType = user.user_type === 'super_admin' || isSuperAdmin(user.id, user.user_type);
    } else {
      matchesType = user.user_type === filterType;
    }
    
    return matchesSearch && matchesType;
  });

  const userStats = {
    total: users.length,
    fans: users.filter(u => u.user_type === 'fan').length,
    artists: users.filter(u => u.user_type === 'artist').length,
    admins: users.filter(u => {
      // Only count super admins if current user is super admin
      if (isSuperAdmin(userProfile?.id, userProfile?.user_type)) {
        return u.user_type === 'global_admin' || u.user_type === 'super_admin' || isSuperAdmin(u.id, u.user_type);
      }
      // Regular admins only see global_admin users (super admins are filtered out in fetchUsers)
      return u.user_type === 'global_admin';
    }).length,
  };

  // ✅ FIXED: Proper admin access check - allow both global_admin and super_admin
  const isCurrentUserAdmin = userProfile?.user_type === 'global_admin' || 
                            userProfile?.user_type === 'super_admin' || 
                            isSuperAdmin(userProfile?.id, userProfile?.user_type);
  
  if (!userProfile || !isCurrentUserAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 flex items-center justify-center relative overflow-hidden">
        {/* Animated Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>
        <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-12 border border-red-500/30 shadow-2xl max-w-md text-center relative z-10">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center border-4 border-red-500/30">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
            Access Denied
          </h2>
          <p className="text-gray-400 text-lg">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-950 pt-24 px-6 relative overflow-x-auto">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/5 rounded-full blur-3xl"></div>
      </div>

      <div className="container mx-auto relative z-10">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 mb-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-300 via-blue-300 to-cyan-300 bg-clip-text text-transparent mb-2 flex items-center">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mr-3 shadow-xl shadow-purple-500/30">
                  <User className="w-7 h-7 text-white" />
                </div>
                User Management
              </h1>
              <p className="text-gray-400 text-lg mt-2">Manage all platform users and their permissions</p>
            </div>
            
            {/* Stats Cards */}
            <div className="flex flex-wrap gap-4">
              <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-xl px-5 py-4 rounded-2xl border border-purple-500/30 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total Users</p>
                    <p className="text-2xl font-bold text-white">{userStats.total}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 backdrop-blur-xl px-5 py-4 rounded-2xl border border-blue-500/30 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Artists</p>
                    <p className="text-2xl font-bold text-white">{userStats.artists}</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-yellow-600/20 to-orange-600/20 backdrop-blur-xl px-5 py-4 rounded-2xl border border-yellow-500/30 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Admins</p>
                    <p className="text-2xl font-bold text-white">{userStats.admins}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-gradient-to-r from-yellow-600/20 via-orange-600/20 to-yellow-600/20 backdrop-blur-sm border-2 border-yellow-500/50 text-yellow-300 px-6 py-4 rounded-2xl flex items-center gap-3 shadow-xl">
            <AlertCircle className="h-6 w-6 text-yellow-400 flex-shrink-0" />
            <span className="font-semibold">New users must sign up through the registration page</span>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search users by name, email, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 shadow-xl"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="pl-10 pr-10 py-3 bg-gradient-to-br from-gray-900/80 to-gray-800/60 backdrop-blur-xl border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500/50 shadow-xl appearance-none cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="fan">Fans</option>
              <option value="artist">Artists</option>
              <option value="global_admin">Admins</option>
              {isSuperAdmin(userProfile?.id, userProfile?.user_type) && (
                <option value="super_admin">Super Admins</option>
              )}
            </select>
          </div>
          <button
            onClick={fetchUsers}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all duration-300 flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-gradient-to-r from-red-600/20 via-red-500/20 to-red-600/20 backdrop-blur-sm border-2 border-red-500/50 text-red-300 px-6 py-4 rounded-2xl mb-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <p className="font-semibold">{error}</p>
            </div>
          </div>
        )}

      {loading ? (
        <div className="flex flex-col justify-center items-center py-16">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500/30 border-t-purple-500"></div>
            <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border-2 border-purple-500/20"></div>
          </div>
          <p className="mt-6 text-gray-400 font-medium">Loading users...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16">
          <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl p-12 max-w-md mx-auto border border-white/10 shadow-2xl">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
              <User className="w-10 h-10 text-purple-400" />
            </div>
            <p className="text-gray-300 text-xl font-semibold mb-2">No users found</p>
            <p className="text-gray-500 text-sm">
              {searchQuery || filterType !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'No users registered yet'}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-gray-900/80 via-gray-800/60 to-gray-900/80 backdrop-blur-xl rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-white/10 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-purple-600/10">
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
                          <User className="h-6 w-6 text-purple-400" />
                        </div>
                        <div>
                          <div className="text-base font-bold text-white">
                            {user.full_name || 'Unnamed User'}
                          </div>
                          <div className="text-xs text-gray-400 font-mono">
                            {user.id.substring(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-300">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {(user.user_type === 'super_admin' || isSuperAdmin(user.id, user.user_type)) ? (
                          <>
                            <Crown className="h-5 w-5 text-yellow-400" />
                            <span className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border border-yellow-500/30 rounded-xl px-3 py-1.5 text-xs font-bold">
                              Super Admin
                            </span>
                          </>
                        ) : (
                          <>
                            {user.user_type === 'global_admin' ? (
                              <ShieldAlert className="h-5 w-5 text-red-400" />
                            ) : user.user_type === 'artist' ? (
                              <Shield className="h-5 w-5 text-purple-400" />
                            ) : (
                              <User className="h-5 w-5 text-gray-400" />
                            )}
                            {/* Only show role change dropdown for Super Admins */}
                            {isSuperAdmin(userProfile?.id, userProfile?.user_type) ? (
                              <select
                                value={user.user_type}
                                onChange={(e) => handleUpdateUserType(user.id, e.target.value)}
                                disabled={user.id === userProfile?.id}
                                className={`bg-gradient-to-br from-gray-800/80 to-gray-700/60 backdrop-blur-sm border border-white/10 text-white rounded-xl px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                                  user.id === userProfile?.id
                                    ? 'opacity-50 cursor-not-allowed' 
                                    : 'hover:bg-gray-700/80 cursor-pointer'
                                }`}
                                title={
                                  user.id === userProfile?.id 
                                    ? "Cannot change your own user type"
                                    : undefined
                                }
                              >
                                <option value="fan">Fan</option>
                                <option value="artist">Artist</option>
                                <option value="global_admin">Admin</option>
                                <option value="super_admin">Super Admin</option>
                              </select>
                            ) : (
                              /* For global_admin users, show read-only badge */
                              <span className={`bg-gradient-to-r rounded-xl px-3 py-1.5 text-xs font-bold ${
                                user.user_type === 'global_admin'
                                  ? 'from-red-500/20 to-orange-500/20 text-red-400 border border-red-500/30'
                                  : user.user_type === 'artist'
                                  ? 'from-purple-500/20 to-pink-500/20 text-purple-400 border border-purple-500/30'
                                  : 'from-gray-500/20 to-gray-600/20 text-gray-400 border border-gray-500/30'
                              }`}>
                                {user.user_type === 'global_admin' ? 'Admin' :
                                 user.user_type === 'artist' ? 'Artist' : 'Fan'}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Calendar className="h-4 w-4 text-gray-500" />
                        <span>{new Date(user.created_at).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {(user.user_type === 'super_admin' || isSuperAdmin(user.id, user.user_type)) ? (
                        <div className="flex items-center gap-2 text-yellow-400 text-xs font-semibold">
                          <Shield className="h-4 w-4" />
                          <span>Protected</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={user.id === userProfile?.id || (user.user_type === 'global_admin' && !isSuperAdmin(userProfile?.id, userProfile?.user_type))}
                          className={`w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-red-500/30 text-red-400 hover:from-red-500/30 hover:to-rose-500/30 transition-all duration-300 flex items-center justify-center group ${
                            user.id === userProfile?.id || (user.user_type === 'global_admin' && !isSuperAdmin(userProfile?.id, userProfile?.user_type))
                              ? 'opacity-50 cursor-not-allowed'
                              : ''
                          }`}
                          title={
                            user.id === userProfile?.id
                              ? "Cannot delete your own account"
                              : user.user_type === 'global_admin' && !isSuperAdmin(userProfile?.id, userProfile?.user_type)
                              ? "Only super admin can delete other admins"
                              : "Delete user"
                          }
                        >
                          <UserX className="h-5 w-5 group-hover:scale-110 transition-transform" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Results Count */}
          <div className="px-6 py-4 border-t border-white/10 bg-gradient-to-r from-purple-600/5 via-pink-600/5 to-purple-600/5">
            <p className="text-sm text-gray-400">
              Showing <span className="font-bold text-white">{filteredUsers.length}</span> of <span className="font-bold text-white">{users.length}</span> users
            </p>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default UserManagement;