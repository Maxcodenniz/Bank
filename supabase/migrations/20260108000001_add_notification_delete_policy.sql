/*
  # Add Delete Policy for Notifications
  
  1. Changes
    - Add RLS policy allowing users to delete their own notifications
    - This enables the notification panel to delete individual notifications and clear all notifications
  
  2. Security
    - Only users can delete their own notifications (auth.uid() = user_id)
*/

-- Allow users to delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);



