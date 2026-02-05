/*
  # Payment Information Encryption Support
  
  1. Changes
    - Add encrypted versions of payment fields
    - Keep original fields for migration period
    - Add encryption flag to track encrypted data
    
  2. Security
    - Payment data should be encrypted at application level
    - Database stores encrypted values
*/

-- Add encrypted payment fields
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS bank_iban_encrypted TEXT,
ADD COLUMN IF NOT EXISTS mobile_payment_number_encrypted TEXT,
ADD COLUMN IF NOT EXISTS mobile_payment_name_encrypted TEXT,
ADD COLUMN IF NOT EXISTS payment_data_encrypted BOOLEAN DEFAULT false;

-- Add index for encrypted flag
CREATE INDEX IF NOT EXISTS idx_profiles_payment_encrypted 
ON profiles(payment_data_encrypted) 
WHERE payment_data_encrypted = true;

-- Migration note: Existing plain text data will need to be encrypted via application
-- After encryption, plain text fields can be cleared manually by admins




