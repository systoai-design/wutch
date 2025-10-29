-- First, handle existing NULL display names by setting them to username
UPDATE profiles
SET display_name = username
WHERE display_name IS NULL;

-- Handle duplicate display names by appending numeric suffixes
WITH duplicates AS (
  SELECT id, display_name, 
         ROW_NUMBER() OVER (PARTITION BY display_name ORDER BY created_at) as rn
  FROM profiles
  WHERE display_name IS NOT NULL
)
UPDATE profiles
SET display_name = profiles.display_name || '_' || duplicates.rn
FROM duplicates
WHERE profiles.id = duplicates.id 
  AND duplicates.rn > 1;

-- Add NOT NULL constraint to display_name
ALTER TABLE profiles
ALTER COLUMN display_name SET NOT NULL;

-- Add unique constraint to display_name
ALTER TABLE profiles
ADD CONSTRAINT profiles_display_name_unique UNIQUE (display_name);