'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import axios from 'axios';
import { handleMarkAsRead, handleMarkAsUnread, handleMoveToTrash, handleRestoreFromTrash } from '../lib/apiHandlers';
import { NewsletterList } from '../components/NewsletterList';
import { NewsletterViewer } from '../components/NewsletterViewer';
import { Newsletter } from '../types/newsletter';

export default function Home() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNewsletter, setSelectedNewsletter] = useState<Newsletter | null>(null);
  const [showToast, setShowToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'trash'>('active');
  const [userId, setUserId] = useState<string | null>(null);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlUserId = urlParams.get('userId');

    if (urlUserId) {
      localStorage.setItem('userId', urlUserId);
      setUserId(urlUserId);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      const storedUserId = localStorage.getItem('userId');
      if (storedUserId) {
        setUserId(storedUserId);
      } else {
        setError('Por favor, faça o login.');
        setLoading(false);
      }
    }
  }, []);

  const handleLogin = () => {
    const tempUserId = `user_${Date.now()}`;
    localStorage.setItem('userId', tempUserId);
    window.location.href = `${BACKEND_URL}/api/auth/google?userId=${tempUserId}`;
  };

  const getFilteredNewsletters = useCallback(() => {
    switch (filterMode) {
      case 'active':
        return newsletters.filter(nl => !nl.isInTrash);
      case 'trash':
        return newsletters.filter(nl => nl.isInTrash);
      case 'all':
      default:
        return newsletters;
    }
  }, [newsletters, filterMode]);

  const handleAction = useCallback(async (action: 'read' | 'unread' | 'trash' | 'untrash', newsletterToUpdate: Newsletter) => {
    try {
      let result;
      if (action === 'read') {
        result = await handleMarkAsRead(BACKEND_URL, newsletterToUpdate.messageId, userId as string);
      } else if (action === 'unread') {
        result = await handleMarkAsUnread(BACKEND_URL, newsletterToUpdate.messageId, userId as string);
      } else if (action === 'trash') {
        result = await handleMoveToTrash(BACKEND_URL, newsletterToUpdate.messageId, userId as string);
      } else if (action === 'untrash') {
        result = await handleRestoreFromTrash(BACKEND_URL, newsletterToUpdate.messageId, userId as string);
      }

      if (result?.success) {
        const actionText = action === 'read' ? 'marcada como lida' :
          action === 'unread' ? 'marcada como não lida' :
            action === 'trash' ? 'movida para a lixeira' :
              'restaurada da lixeira';
        showTemporaryToast(`Newsletter ${actionText} no Gmail.`, 'success');

        // Atualiza o estado da newsletter selecionada no modal, se ainda estiver aberto
        setSelectedNewsletter(prev => prev ? {
          ...prev,
          isRead: action === 'read' ? true : action === 'unread' ? false : prev.isRead,
          isInTrash: action === 'trash' ? true : action === 'untrash' ? false : prev.isInTrash,
          labels: action === 'read' ? prev.labels.filter(label => label !== 'UNREAD') :
            action === 'unread' ? [...prev.labels.filter(label => label !== 'UNREAD'), 'UNREAD'] :
              action === 'trash' ? [...prev.labels.filter(label => label !== 'UNREAD'), 'TRASH'] :
                action === 'untrash' ? prev.labels.filter(label => label !== 'TRASH') : prev.labels
        } : null);

        // Atualizar o estado 'newsletters' localmente e salvar no localStorage
        const updatedNewsletters = newsletters.map(nl =>
          nl.messageId === newsletterToUpdate.messageId
            ? {
              ...nl,
              isRead: action === 'read' ? true : action === 'unread' ? false : nl.isRead,
              isInTrash: action === 'trash' ? true : action === 'untrash' ? false : nl.isInTrash,
              labels: action === 'read' ? nl.labels.filter(label => label !== 'UNREAD') :
                action === 'unread' ? [...nl.labels.filter(label => label !== 'UNREAD'), 'UNREAD'] :
                  action === 'trash' ? [...nl.labels.filter(label => label !== 'UNREAD'), 'TRASH'] :
                    action === 'untrash' ? nl.labels.filter(label => label !== 'TRASH') : nl.labels
            }
            : nl
        );

        setNewsletters(updatedNewsletters);
        saveToLocalStorage(updatedNewsletters);

      } else {
        const actionText = action === 'read' ? 'marcar como lida' :
          action === 'unread' ? 'marcar como não lida' :
            action === 'trash' ? 'mover para a lixeira' :
              'restaurar da lixeira';
        showTemporaryToast(`Erro ao ${actionText}.`, 'error');
      }
    } catch (err) {
      console.error(`Erro ao executar ação ${action}:`, err);
      const actionText = action === 'read' ? 'marcar como lida' :
        action === 'unread' ? 'marcar como não lida' :
          action === 'trash' ? 'mover para a lixeira' :
            'restaurar da lixeira';
      showTemporaryToast(`Erro ao ${actionText}.`, 'error');
    }
  }, [newsletters, BACKEND_URL, userId]);

  const handleNewsletterClick = (newsletter: Newsletter) => {
    setSelectedNewsletter(newsletter);
    handleAction('read', newsletter);
  }

  const handleCloseModal = () => {
    setSelectedNewsletter(null);
  }

  const getCurrentNewsletterIndex = useCallback(() => {
    if (!selectedNewsletter) return -1;
    const filteredNewsletters = getFilteredNewsletters().sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime());
    return filteredNewsletters.findIndex(nl => nl.messageId === selectedNewsletter.messageId);
  }, [selectedNewsletter, getFilteredNewsletters]);

  const navigateNewsletter = useCallback((direction: 'next' | 'previous') => {
    if (!selectedNewsletter) return;

    const filteredNewsletters = getFilteredNewsletters()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const currentIndex = filteredNewsletters.findIndex(nl => nl.messageId === selectedNewsletter.messageId);

    if (currentIndex === -1) return;

    let newIndex;
    if (direction === 'next') {
      newIndex = currentIndex + 1 < filteredNewsletters.length ? currentIndex + 1 : 0;
    } else {
      newIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : filteredNewsletters.length - 1;
    }

    setSelectedNewsletter(filteredNewsletters[newIndex]);
    handleAction('read', filteredNewsletters[newIndex]);
  }, [selectedNewsletter, getFilteredNewsletters, handleAction]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!selectedNewsletter) return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        navigateNewsletter('next');
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        navigateNewsletter('previous');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedNewsletter, navigateNewsletter]);

  const saveToLocalStorage = (newsletters: Newsletter[]) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const NewsletterForStorage = (newsletter: Newsletter) => ({
      messageId: newsletter.messageId,
      subject: newsletter.subject,
      from: newsletter.from,
      date: newsletter.date,
      cleanedHtml: newsletter.isInTrash
        ? newsletter.cleanedHtml.substring(0, 80000) // Apenas 80KB para lixeira
        : newsletter.cleanedHtml.substring(0, 100000), // 100KB para ativas
      originalHtml: '',
      isRead: newsletter.isRead,
      isInTrash: newsletter.isInTrash,
      labels: newsletter.labels
    });

    const filteredNewsletters = newsletters
      .filter(newsletter => {
        if (newsletter.isInTrash) {
          return new Date(newsletter.date) > thirtyDaysAgo;
        }
        return true;
      })
      .map(NewsletterForStorage);

    const maxCacheSize = 200;
    const finalNewsletters = filteredNewsletters.length > maxCacheSize
      ? filteredNewsletters
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, maxCacheSize)
      : filteredNewsletters;

    try { // Tenta salvar normalmente
      const dataString = JSON.stringify(finalNewsletters);
      const sizeInMB = (dataString.length / (1024 * 1024)).toFixed(2);

      console.log(`Tentando salvar ${sizeInMB}MB no localStorage`);

      if (dataString.length > 4 * 1024 * 1024) {
        console.warn('Dados muito grandes, reduzindo ainda mais...');

        // Última tentativa: salva apenas 100 newsletters com HTML reduzido
        const emergencyCut = finalNewsletters
          .slice(0, 100)
          .map(nl => ({
            ...nl,
            cleanedHtml: nl.cleanedHtml.substring(0, 100000) // Máximo 100KB cada
          }));

        localStorage.setItem('newsletters', JSON.stringify(emergencyCut));
        localStorage.setItem('lastSync', new Date().toISOString());

        console.log(`Cache de emergência: ${emergencyCut.length} newsletters (reduzidas)`);
      } else {
        localStorage.setItem('newsletters', dataString);
        localStorage.setItem('lastSync', new Date().toISOString());

        console.log(`Cache atualizado: ${finalNewsletters.length} newsletters (${finalNewsletters.filter(n => !n.isInTrash).length} ativas, ${finalNewsletters.filter(n => n.isInTrash).length} na lixeira) - ${sizeInMB}MB`);
      }

    } catch (error) {
      console.error('Erro ao salvar no localStorage:', error);
    }
  };

  const loadFromLocalStorage = (): Newsletter[] => {
    const saved = localStorage.getItem('newsletters');
    return saved ? JSON.parse(saved) : [];
  };

  const fetchNewslettersFromGmail = useCallback(async () => {
    if (!userId) {
      setError('Por favor, faça o login para buscar newsletters.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/gmail/messages`, {
        headers: {
          'Authorization': `Bearer ${userId}`
        }
      });
      const data = response.data;

      if (data.newsletters) {
        saveToLocalStorage(data.newsletters);
        setNewsletters(data.newsletters);
        showTemporaryToast(`${data.newsletters.length} newsletters carregadas!`, 'success');
      }
    } catch (err) {
      console.error('Erro ao buscar newsletters:', err);
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError('Não autenticado ou sessão expirada. Por favor, faça login novamente.');
      } else {
        setError('Erro ao buscar newsletters. Carregando do cache local...');
        const cached = loadFromLocalStorage();
        setNewsletters(cached);
        if (cached.length > 0) {
          showTemporaryToast(`${cached.length} newsletters carregadas do cache local.`, 'success');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [BACKEND_URL, userId]);

  const loadInitialData = useCallback(() => {
    const cached = loadFromLocalStorage();
    if (cached.length > 0) {
      setNewsletters(cached);
      setLoading(false);
      showTemporaryToast(`${cached.length} newsletters carregadas do cache local.`, 'success');
    } else {
      fetchNewslettersFromGmail();
    }
  }, [fetchNewslettersFromGmail]);

  const syncWithGmail = useCallback(async () => {
    try {
      showTemporaryToast('Sincronizando com o Gmail...', 'success');
      await fetchNewslettersFromGmail();
    } catch (err) {
      console.error('Erro ao sincronizar com o Gmail:', err);
      showTemporaryToast('Erro na sincronização com o Gmail.', 'error');
    }
  }, [fetchNewslettersFromGmail]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const showTemporaryToast = (message: string, type: 'success' | 'error') => {
    setShowToast({ message, type });
    setTimeout(() => {
      setShowToast(null);
    }, 3000);
  };

  if (!userId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-cinereous text-black">
        <h1 className="text-4xl font-bold mb-8 text-snow">AgregaNews</h1>
        <p className="text-lg mb-4 text-snow">Para continuar faça login com sua conta do Google.</p>
        <button
          onClick={handleLogin}
          className="bg-blue-600 hover:bg-blue-700 text-snow text-lg font-bold py-3 px-6 rounded-md transition-colors duration-300"
        >
          Entrar com Google
        </button>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-cinereous text-black">
        <h1 className="text-4xl font-bold mb-8">Carregando newsletters...</h1>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-almond text-black">
        <Image src="/error-icon.png" alt="Erro" className='mb-4 max-w-xs' width={200} height={200} />
        <h1 className="text-4xl font-bold mb-8 ">Erro: {error}</h1>
        {error && (error.includes('autenticado') || error.includes('login')) && (
          <p className="text-lg">
            <a href={`${BACKEND_URL}/auth/google?userId=${userId}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              Clique aqui para autenticar com o Google
            </a>
            {' '}e depois recarregue esta página.
          </p>
        )}
      </main>
    );
  }

  const filteredNewsletters = getFilteredNewsletters()

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-6 lg:p-8 bg-cinereous">
      <h1 className="text-5xl md:text-6xl font-extrabold text-center text-snow mb-8 tracking-wide">
        AgregaNews
      </h1>

      {showToast && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-snow ${showToast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} z-50`}>
          {showToast.message}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center mx-auto mb-6 gap-y-4 md:gap-y-0">
        <div className="flex flex-col md:flex-row items-center gap-y-2 md:gap-y-0 md:gap-x-4 bg-almond p-4 rounded-lg shadow-md">
          <p className="text-lg text-black ">
            <b>{newsletters.length}</b> mensagens encontradas | <b className='text-blue-700'>{newsletters.filter(nl => !nl.isRead).length}</b> não lidas | <b className='text-green-700'>{newsletters.filter(nl => !nl.isInTrash).length}</b> ativas | <b className='text-red-700'>{newsletters.filter(nl => nl.isInTrash).length}</b> na lixeira
          </p>

          <div className="flex gap-x-2">
            <button
              type='button'
              title='Mostrar todas as newsletters'
              aria-label='Mostrar todas as newsletters'
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-md text-sm transition-colors cursor-pointer ${filterMode === 'all'
                ? 'bg-blue-600 text-snow'
                : 'bg-snow text-gray-700 hover:bg-gray-300'
                }`}
            >
              Todas
            </button>
            <button
              type='button'
              title='Mostrar apenas newsletters ativas'
              aria-label='Mostrar apenas newsletters ativas'
              onClick={() => setFilterMode('active')}
              className={`px-3 py-1 rounded-md text-sm transition-colors cursor-pointer ${filterMode === 'active'
                ? 'bg-green-600 text-snow'
                : 'bg-snow text-gray-700 hover:bg-gray-300'
                }`}
            >
              Ativas
            </button>
            <button
              type='button'
              title='Mostrar apenas newsletters na lixeira'
              aria-label='Mostrar apenas newsletters na lixeira'
              onClick={() => setFilterMode('trash')}
              className={`px-3 py-1 rounded-md text-sm transition-colors cursor-pointer ${filterMode === 'trash'
                ? 'bg-red-600 text-snow'
                : 'bg-snow text-gray-700 hover:bg-gray-300'
                }`}
            >
              Lixeira
            </button>
          </div>
          <button
            type='button'
            title='Sincronizar com Gmail'
            aria-label='Sincronizar com Gmail'
            disabled={loading}
            onClick={syncWithGmail}
            className="bg-blue-600 hover:bg-blue-700 text-snow text-sm font-bold py-2 px-4 rounded-md transition-colors duration-300 cursor-pointer"
          >
            Sincronizar com Gmail
          </button>
        </div>

      </div>

      <div className='flex flex-col lg:flex-row h-screen'>
        {newsletters.length === 0 ? (
          <p className="text-center text-xl text-black">Nenhuma newsletter encontrada. Verifique se há e-mails no Gmail e se o backend está autenticado e sincronizado.</p>
        ) : (
          <>
            <NewsletterList
              newsletters={filteredNewsletters}
              onSelectNewsletter={handleNewsletterClick}
              onAction={handleAction}
              selectedNewsletter={selectedNewsletter}
            />

            <div className="flex-1 lg:w-3/4 h-full overflow-y-auto p-4 lg:p-6">
              <NewsletterViewer
                newsletter={selectedNewsletter}
                onClose={handleCloseModal}
                onAction={handleAction}
                onNavigate={navigateNewsletter}
                currentIndex={getCurrentNewsletterIndex()}
                totalCount={filteredNewsletters.length}
              />
            </div>
          </>
        )}
      </div>
    </main>
  );
}