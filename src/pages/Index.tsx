import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';

const API_URL = 'https://functions.poehali.dev/bde3e8c7-a00c-481b-961f-bcd36e62e805';

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
  const { toast } = useToast();
  const deviceId = generateDeviceId();

  const fetchVotingData = async () => {
    try {
      const response = await fetch(API_URL);
      const data = await response.json();
      setVotingData(data);
    } catch (error) {
      console.error('Error fetching voting data:', error);
    }
  };

  useEffect(() => {
    fetchVotingData();
    const voted = localStorage.getItem('hasVoted');
    if (voted === 'true') setHasVoted(true);
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

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold font-['Montserrat']">Голосование</h1>
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
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-12">
        {activeSection === 'main' && (
          <div className="animate-fade-in">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4 font-['Montserrat']">
                Выберите лучшее видео
              </h2>
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
                    <div className="aspect-video bg-muted">
                      <iframe
                        width="100%"
                        height="100%"
                        src={video.youtube_url}
                        title={video.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
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
                        className="w-full"
                        size="lg"
                      >
                        {hasVoted ? (
                          <>
                            <Icon name="Check" size={20} className="mr-2" />
                            Вы проголосовали
                          </>
                        ) : (
                          <>
                            <Icon name="ThumbsUp" size={20} className="mr-2" />
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
      </main>
    </div>
  );
};

export default Index;
