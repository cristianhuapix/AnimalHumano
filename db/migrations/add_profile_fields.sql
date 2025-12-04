-- Migration: Add profile and notification fields to profiles table
-- Run this in Supabase SQL Editor

-- Add primary_email field (email for notifications, can be different from login email)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS primary_email TEXT;

-- Add notification settings fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vaccine_mandatory BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vaccine_optional BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vaccine_days_before INTEGER DEFAULT 30;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday_notifications BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chat_notifications BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS app_notifications BOOLEAN DEFAULT true;

-- Set primary_email to match email for existing users if not set
UPDATE profiles
SET primary_email = email
WHERE primary_email IS NULL;
