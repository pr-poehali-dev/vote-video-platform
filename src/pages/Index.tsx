import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';

const API_URL = 'https://functions.poehali.dev/bde3e8c7-a00c-481b-961f-bcd36e62e805';
const VIDEO_PROXY_URL = 'https://functions.poehali.dev/b04bef60-8902-445f-a44e-c950dfa80094';

const generateDeviceId = () => {
  const stored = localStorage.getItem('deviceId');
  if (stored) return stored;
  
  const newId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('deviceId', newId);
  return newId;
};

interface Video {
  id: number;
  title: string;
  description: string;
  youtube_url: string;
  vote_count: number;
  thumbnail?: string;
  video_url?: string;
}

interface VotingData {
  videos: Video[];
  total_votes: number;
}

const Index = () => {
  const [activeSection, setActiveSection] = useState('main');
  const [votingData, setVotingData] = useState<VotingData | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<number | null>(null);
  const [videoUrls, setVideoUrls] = useState<Record<number, string>>({});
  const [loadingVideo, setLoadingVideo] = useState<number | null>(null);
  const [videoProgress, setVideoProgress] = useState<Record<number, number>>({});
  const [showAdmin, setShowAdmin] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState<number | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const deviceId = generateDeviceId();

  const fetchVotingData = async () => {
    try {
      const response = await fetch(API_URL);
      const data = await response.json();
      setVotingData(data);
      
      // Используем прокси для воспроизведения видео
      const urls: Record<number, string> = {};
      data.videos.forEach((video: Video) => {
        if (video.video_url) {
          urls[video.id] = `${VIDEO_PROXY_URL}?id=${video.id}`;
          console.log(`Видео ${video.id}: готово к воспроизведению через прокси`);
        } else {
          console.log(`Видео ${video.id}: URL не найден в базе`);
        }
      });
      setVideoUrls(urls);
    } catch (error) {
      console.error('Error fetching voting data:', error);
    }
  };

  useEffect(() => {
    fetchVotingData();
    const voted = localStorage.getItem('hasVoted');
    if (voted === 'true') setHasVoted(true);
    
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        setShowAdmin(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handleVote = async (videoChoice: number) => {
    if (hasVoted) {
      toast({
        title: 'Вы уже голосовали',
        description: 'С одного устройства можно проголосовать только один раз',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, videoChoice }),
      });

      const data = await response.json();

      if (response.ok) {
        setHasVoted(true);
        localStorage.setItem('hasVoted', 'true');
        await fetchVotingData();
        toast({
          title: 'Голос принят!',
          description: 'Спасибо за участие в голосовании',
        });
        setActiveSection('results');
      } else {
        toast({
          title: 'Ошибка',
          description: data.message || 'Не удалось проголосовать',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Произошла ошибка при голосовании',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getPercentage = (votes: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((votes / total) * 100);
  };

  const handleYandexUrlSubmit = async (videoId: number, yandexUrl: string) => {
    setUploadingVideo(videoId);

    try {
      const publicKey = yandexUrl.split('/').pop();
      const directUrl = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(yandexUrl)}`;
      
      const response = await fetch(directUrl);
      const data = await response.json();
      
      if (data.href) {
        const videoUrl = data.href;
        setVideoUrls(prev => ({ ...prev, [videoId]: videoUrl }));
        localStorage.setItem(`video_${videoId}`, videoUrl);

        const uploadResponse = await fetch('https://functions.poehali.dev/8d0d0014-5e4b-4a12-a934-dacbc6a832bb', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId,
            fileDataUrl: videoUrl
          })
        });

        if (uploadResponse.ok) {
          toast({
            title: 'Успех!',
            description: 'Видео добавлено и готово к воспроизведению',
          });
          
          const input = document.getElementById(`yandex-url-${videoId}`) as HTMLInputElement;
          if (input) input.value = '';
        }
      } else {
        throw new Error('Не удалось получить ссылку');
      }
      
      setUploadingVideo(null);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить видео с Яндекс.Диска. Проверьте что ссылка публичная',
        variant: 'destructive',
      });
      setUploadingVideo(null);
    }
  };

  const handleVideoUpload = async (videoId: number, file: File) => {
    if (!file.type.startsWith('video/')) {
      toast({
        title: 'Ошибка',
        description: 'Пожалуйста, выберите видео файл',
        variant: 'destructive',
      });
      return;
    }

    setUploadingVideo(videoId);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Data = e.target?.result as string;
          
          setVideoUrls(prev => ({ ...prev, [videoId]: base64Data }));
          localStorage.setItem(`video_${videoId}`, base64Data);

          const uploadResponse = await fetch('https://functions.poehali.dev/8d0d0014-5e4b-4a12-a934-dacbc6a832bb', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              videoId,
              fileDataUrl: base64Data
            })
          });

          if (uploadResponse.ok) {
            toast({
              title: 'Успех!',
              description: 'Видео загружено и готово к воспроизведению',
            });
          } else {
            toast({
              title: 'Предупреждение',
              description: 'Видео сохранено локально',
            });
          }
          
          setUploadingVideo(null);
        } catch (err) {
          console.error('Upload error:', err);
          setUploadingVideo(null);
        }
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить видео',
        variant: 'destructive',
      });
      setUploadingVideo(null);
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-40 -z-10"
        style={{ backgroundImage: 'url(https://cdn.poehali.dev/files/e15f8101-7ee9-42a0-9ecc-1cf9a643afff.jpeg)' }}
      />
      <div className="fixed inset-0 bg-gradient-to-b from-primary/20 via-background/50 to-background/80 -z-10" />
      <nav className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 
              className="text-2xl font-bold font-['Montserrat'] cursor-pointer select-none"
              onTouchStart={() => {
                const timer = setTimeout(() => {
                  const newState = !showAdmin;
                  setShowAdmin(newState);
                  toast({
                    title: newState ? 'Админ режим включен' : 'Админ режим выключен',
                    description: newState ? 'Перейдите в раздел "Админ"' : ''
                  });
                }, 1000);
                setLongPressTimer(timer);
              }}
              onTouchEnd={() => {
                if (longPressTimer) {
                  clearTimeout(longPressTimer);
                  setLongPressTimer(null);
                }
              }}
              onMouseDown={() => {
                const timer = setTimeout(() => {
                  const newState = !showAdmin;
                  setShowAdmin(newState);
                  toast({
                    title: newState ? 'Админ режим включен' : 'Админ режим выключен',
                    description: newState ? 'Перейдите в раздел "Админ"' : ''
                  });
                }, 1000);
                setLongPressTimer(timer);
              }}
              onMouseUp={() => {
                if (longPressTimer) {
                  clearTimeout(longPressTimer);
                  setLongPressTimer(null);
                }
              }}
              onMouseLeave={() => {
                if (longPressTimer) {
                  clearTimeout(longPressTimer);
                  setLongPressTimer(null);
                }
              }}
            >
              ПЕРЕЗАГРУЗКА БИТВА
            </h1>
            <div className="flex gap-6">
              <button
                onClick={() => setActiveSection('main')}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  activeSection === 'main' ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                Главная
              </button>
              <button
                onClick={() => setActiveSection('results')}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  activeSection === 'results' ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                Результаты
              </button>
              <button
                onClick={() => setActiveSection('rules')}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  activeSection === 'rules' ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                Правила
              </button>
              <button
                onClick={() => setActiveSection('about')}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  activeSection === 'about' ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                О проекте
              </button>
              {showAdmin && (
                <button
                  onClick={() => setActiveSection('admin')}
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    activeSection === 'admin' ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  Админ
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-12">
        {activeSection === 'main' && (
          <div className="animate-fade-in">
            <div className="text-center mb-12">
              <h2 className="text-5xl font-bold mb-4 font-['Montserrat'] tracking-tight">
                ПЕРЕЗАГРУЗКА БИТВА
              </h2>
              <p className="text-xl font-medium mb-2">
                Кто станет мастером преображения
              </p>
              <p className="text-muted-foreground text-lg">
                Посмотрите оба видео и проголосуйте за понравившееся
              </p>
            </div>

            {votingData && (
              <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
                {votingData.videos.map((video) => (
                  <Card
                    key={video.id}
                    className="overflow-hidden hover-scale transition-all"
                  >
                    <div className="aspect-video bg-black rounded-t-lg overflow-hidden relative group">
                      {playingVideo === video.id && videoUrls[video.id] ? (
                        <video
                          className="w-full h-full object-contain"
                          controls
                          autoPlay
                          src={videoUrls[video.id]}
                          onEnded={() => setPlayingVideo(null)}
                          onLoadStart={() => setLoadingVideo(video.id)}
                          onCanPlay={() => setLoadingVideo(null)}
                          onProgress={(e) => {
                            const video = e.currentTarget;
                            if (video.buffered.length > 0) {
                              const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                              const duration = video.duration;
                              if (duration > 0) {
                                setVideoProgress(prev => ({ ...prev, [video.id]: (bufferedEnd / duration) * 100 }));
                              }
                            }
                          }}
                        >
                          Ваш браузер не поддерживает воспроизведение видео.
                        </video>
                      ) : (
                        <div 
                          onClick={() => setPlayingVideo(video.id)}
                          className="w-full h-full flex items-center justify-center relative cursor-pointer"
                        >
                          {video.thumbnail ? (
                            <>
                              <img 
                                src={video.thumbnail} 
                                alt={video.title}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-colors flex items-center justify-center">
                                <Icon name="Play" size={64} className="text-white group-hover:scale-110 transition-transform" />
                              </div>
                            </>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                              <Icon name="Play" size={64} className="text-primary group-hover:scale-110 transition-transform" />
                              <span className="text-lg font-medium">Воспроизвести видео</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {loadingVideo === video.id && (
                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 z-10">
                          <Icon name="Loader2" size={48} className="text-white animate-spin" />
                          <div className="w-2/3 max-w-xs">
                            <Progress value={videoProgress[video.id] || 0} className="h-2" />
                          </div>
                          <span className="text-white text-sm">
                            Загрузка видео... {Math.round(videoProgress[video.id] || 0)}%
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-6">
                      <h3 className="text-2xl font-bold mb-2 font-['Montserrat']">
                        {video.title}
                      </h3>
                      <p className="text-muted-foreground mb-6">
                        {video.description}
                      </p>
                      <Button
                        onClick={() => handleVote(video.id)}
                        disabled={hasVoted || isLoading}
                        className={`w-full bg-primary hover:bg-primary/90 text-white font-bold text-lg py-6 shadow-lg hover:shadow-xl transition-all hover:scale-105 ${!hasVoted && !isLoading ? 'animate-pulse' : ''}`}
                        size="lg"
                      >
                        {hasVoted ? (
                          <>
                            <Icon name="Check" size={24} className="mr-2" />
                            Вы проголосовали
                          </>
                        ) : (
                          <>
                            <Icon name="ThumbsUp" size={24} className="mr-2" />
                            Голосовать
                          </>
                        )}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {hasVoted && (
              <div className="text-center mt-8 animate-fade-in">
                <Button
                  onClick={() => setActiveSection('results')}
                  variant="outline"
                  size="lg"
                >
                  Посмотреть результаты
                  <Icon name="ChevronRight" size={20} className="ml-2" />
                </Button>
              </div>
            )}
          </div>
        )}

        {activeSection === 'results' && (
          <div className="animate-fade-in max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4 font-['Montserrat']">
                Результаты голосования
              </h2>
              <p className="text-muted-foreground text-lg">
                Всего голосов: {votingData?.total_votes || 0}
              </p>
            </div>

            {votingData && (
              <div className="space-y-8">
                {votingData.videos.map((video) => {
                  const percentage = getPercentage(
                    video.vote_count,
                    votingData.total_votes
                  );
                  return (
                    <Card key={video.id} className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-2xl font-bold font-['Montserrat']">
                          {video.title}
                        </h3>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-primary">
                            {percentage}%
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {video.vote_count} голосов
                          </div>
                        </div>
                      </div>
                      <Progress value={percentage} className="h-3" />
                    </Card>
                  );
                })}
              </div>
            )}

            <div className="text-center mt-8">
              <Button
                onClick={() => setActiveSection('main')}
                variant="outline"
                size="lg"
              >
                <Icon name="ChevronLeft" size={20} className="mr-2" />
                Вернуться к голосованию
              </Button>
            </div>
          </div>
        )}

        {activeSection === 'rules' && (
          <div className="animate-fade-in max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4 font-['Montserrat']">
                Правила голосования
              </h2>
            </div>

            <Card className="p-8">
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold">1</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">Один голос с устройства</h3>
                    <p className="text-muted-foreground">
                      С одного устройства можно проголосовать только один раз. Повторное
                      голосование невозможно.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold">2</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">
                      Посмотрите оба видео
                    </h3>
                    <p className="text-muted-foreground">
                      Рекомендуем посмотреть оба видео перед тем, как сделать выбор.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold">3</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">
                      Результаты в реальном времени
                    </h3>
                    <p className="text-muted-foreground">
                      После голосования вы можете посмотреть результаты в разделе
                      "Результаты".
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold">4</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-2">Честное голосование</h3>
                    <p className="text-muted-foreground">
                      Голосуйте честно за то видео, которое вам действительно
                      понравилось больше.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <div className="text-center mt-8">
              <Button onClick={() => setActiveSection('main')} size="lg">
                Начать голосование
                <Icon name="ChevronRight" size={20} className="ml-2" />
              </Button>
            </div>
          </div>
        )}

        {activeSection === 'about' && (
          <div className="animate-fade-in max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4 font-['Montserrat']">
                О проекте
              </h2>
            </div>

            <Card className="p-8">
              <div className="prose prose-lg max-w-none">
                <p className="text-muted-foreground leading-relaxed mb-6">
                  Это платформа для честного и прозрачного голосования между видео.
                  Каждый участник может выбрать одно из двух представленных видео и
                  увидеть результаты голосования в реальном времени.
                </p>

                <h3 className="font-bold text-xl mb-4 font-['Montserrat']">
                  Технологии
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  Платформа разработана с использованием современных веб-технологий и
                  обеспечивает защиту от повторного голосования с одного устройства.
                </p>

                <h3 className="font-bold text-xl mb-4 font-['Montserrat']">
                  Безопасность
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Система автоматически определяет устройство участника и не позволяет
                  голосовать повторно. Все голоса сохраняются в защищенной базе данных.
                </p>
              </div>
            </Card>

            <div className="text-center mt-8">
              <Button onClick={() => setActiveSection('main')} size="lg">
                К голосованию
                <Icon name="ChevronRight" size={20} className="ml-2" />
              </Button>
            </div>
          </div>
        )}

        {activeSection === 'admin' && showAdmin && (
          <div className="animate-fade-in max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4 font-['Montserrat']">
                Панель администратора
              </h2>
              <p className="text-muted-foreground mb-2">Добавьте ссылки на видео с Яндекс.Диска</p>
              <p className="text-xs text-muted-foreground">
                Вставьте публичную ссылку на видео. Для выхода нажмите Ctrl+Shift+A
              </p>
            </div>

            {votingData && (
              <div className="grid md:grid-cols-2 gap-8">
                {votingData.videos.map((video) => (
                  <Card key={video.id} className="p-6">
                    <h3 className="font-bold text-xl mb-4">{video.title}</h3>
                    <p className="text-muted-foreground mb-6">{video.description}</p>
                    
                    {video.thumbnail && (
                      <div className="mb-4">
                        <img 
                          src={video.thumbnail} 
                          alt={video.title}
                          className="w-full aspect-video object-cover rounded-lg"
                        />
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-3">
                        <input
                          type="text"
                          placeholder="https://disk.yandex.ru/i/..."
                          className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          id={`yandex-url-${video.id}`}
                        />
                        <Button
                          onClick={() => {
                            const input = document.getElementById(`yandex-url-${video.id}`) as HTMLInputElement;
                            const url = input?.value;
                            if (url && url.includes('disk.yandex')) {
                              handleYandexUrlSubmit(video.id, url);
                            } else {
                              toast({
                                title: 'Ошибка',
                                description: 'Введите корректную ссылку на Яндекс.Диск',
                                variant: 'destructive'
                              });
                            }
                          }}
                          disabled={uploadingVideo === video.id}
                          className="w-full"
                        >
                          {uploadingVideo === video.id ? (
                            <>
                              <Icon name="Loader2" size={20} className="animate-spin mr-2" />
                              Сохранение...
                            </>
                          ) : (
                            <>
                              <Icon name="Link" size={20} className="mr-2" />
                              Добавить ссылку
                            </>
                          )}
                        </Button>
                      </div>

                      {videoUrls[video.id] && (
                        <div className="flex items-center gap-2 text-sm text-green-600">
                          <Icon name="CheckCircle" size={16} />
                          <span>Видео загружено</span>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            <div className="text-center mt-8">
              <Button onClick={() => setActiveSection('main')} size="lg" variant="outline">
                <Icon name="ChevronLeft" size={20} className="mr-2" />
                Вернуться
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;