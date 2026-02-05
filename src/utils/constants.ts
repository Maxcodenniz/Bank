/**
 * Super Admin Configuration
 * 
 * The super admin ID is configurable via environment variable for flexibility across environments.
 * Falls back to default value if not set in environment.
 * 
 * Set VITE_SUPER_ADMIN_ID in your .env file to override the default.
 */
const DEFAULT_SUPER_ADMIN_ID = 'f20cd4f3-4779-4b21-aa79-7d8ce5e02ed8';

export const SUPER_ADMIN_ID = import.meta.env.VITE_SUPER_ADMIN_ID || DEFAULT_SUPER_ADMIN_ID;

// Warn in development if using default (to encourage setting env var)
if (import.meta.env.DEV && !import.meta.env.VITE_SUPER_ADMIN_ID) {
  console.warn(
    '⚠️ SUPER_ADMIN_ID: Using default value. Set VITE_SUPER_ADMIN_ID in .env for production.'
  );
}

/**
 * Check if a user is the super admin
 * This checks both the protected super admin ID and user_type = 'super_admin'
 * to ensure users promoted to super_admin have full functionality
 */
export const isSuperAdmin = (userId: string | undefined, userType?: string): boolean => {
  if (!userId) return false;
  // Check if user is the protected super admin OR has user_type = 'super_admin'
  return userId === SUPER_ADMIN_ID || userType === 'super_admin';
};

/**
 * Check if current user can modify target user
 * 
 * Rules:
 * - Super admin cannot be modified by anyone (including themselves for safety)
 * - Super admin can modify anyone else
 * - Regular admins cannot modify the super admin
 */
export const canModifyUser = (currentUserId: string | undefined, targetUserId: string): boolean => {
  // Super admin cannot be modified by anyone (including themselves for safety)
  if (targetUserId === SUPER_ADMIN_ID) {
    return false;
  }

  // Super admin can modify anyone else
  if (currentUserId === SUPER_ADMIN_ID) {
    return true;
  }

  // Regular admins cannot modify the super admin
  return targetUserId !== SUPER_ADMIN_ID;
};
