-- Add thumbnail column to videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS thumbnail TEXT;

-- Update first video with thumbnail
UPDATE videos SET thumbnail = 'https://cdn.poehali.dev/files/8cf9d732-e00f-482e-8bd8-60d95c5328f6.png' WHERE id = 1;
