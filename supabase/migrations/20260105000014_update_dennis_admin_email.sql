/*
  # Update Dennis Admin Email
  
  Set the email for the "dennis" admin profile to peterannandennis@gmail.com
  for testing purposes.
*/

-- Update the email for the dennis admin profile
UPDATE profiles
SET email = 'peterannandennis@gmail.com'
WHERE full_name = 'dennis'
AND user_type = 'global_admin'
AND email IS NULL;

-- Verify the update
SELECT id, email, full_name, user_type
FROM profiles
WHERE full_name = 'dennis'
AND user_type = 'global_admin';






