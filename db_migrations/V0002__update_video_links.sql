-- Update video URLs to Yandex.Disk links
UPDATE videos SET 
  title = 'Видео 1', 
  description = 'Первое видео для голосования',
  youtube_url = 'https://disk.yandex.ru/i/jvzaF36uOEXAYQ'
WHERE id = 1;

UPDATE videos SET 
  title = 'Видео 2', 
  description = 'Второе видео для голосования',
  youtube_url = 'https://disk.yandex.ru/i/MduqiNnVit8s2Q'
WHERE id = 2;