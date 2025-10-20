-- Create votes table
CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    device_fingerprint VARCHAR(255) UNIQUE NOT NULL,
    video_choice INTEGER NOT NULL CHECK (video_choice IN (1, 2)),
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_device_fingerprint ON votes(device_fingerprint);

-- Create videos table for storing video information
CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY CHECK (id IN (1, 2)),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    youtube_url TEXT NOT NULL,
    vote_count INTEGER DEFAULT 0
);

-- Insert initial video data
INSERT INTO videos (id, title, description, youtube_url, vote_count) 
VALUES 
    (1, 'Видео 1', 'Первое видео для голосования', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 0),
    (2, 'Видео 2', 'Второе видео для голосования', 'https://www.youtube.com/embed/jNQXAC9IVRw', 0)
ON CONFLICT (id) DO NOTHING;