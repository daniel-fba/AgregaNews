'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import axios from 'axios';
import { handleMarkAsRead, handleMarkAsUnread, handleMoveToTrash, handleRestoreFromTrash } from '../lib/apiHandlers';

interface Newsletter {
  messageId: string;
  subject: string;
  from: string;
  date: string;
  cleanedHtml: string;
  originalHtml: string;
  isRead: boolean;
  isInTrash: boolean;
  labels: string[];
}

export default function Home() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNewsletter, setSelectedNewsletter] = useState<Newsletter | null>(null);
  const [showToast, setShowToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'trash'>('active');

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

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
        result = await handleMarkAsRead(BACKEND_URL, newsletterToUpdate.messageId);
      } else if (action === 'unread') {
        result = await handleMarkAsUnread(BACKEND_URL, newsletterToUpdate.messageId);
      } else if (action === 'trash') {
        result = await handleMoveToTrash(BACKEND_URL, newsletterToUpdate.messageId);
      } else if (action === 'untrash') {
        result = await handleRestoreFromTrash(BACKEND_URL, newsletterToUpdate.messageId);
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
  }, [newsletters, BACKEND_URL]);

  const navigateNewsletter = useCallback((direction: 'next' | 'prev') => {
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
        navigateNewsletter('prev');
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
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${BACKEND_URL}/api/gmail/messages`);
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
  }, [BACKEND_URL]);

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

  const handleNewsletterClick = (newsletter: Newsletter) => {
    setSelectedNewsletter(newsletter);
    handleAction('read', newsletter);
  };

  const handleCloseModal = () => {
    setSelectedNewsletter(null);
  };

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
        {error && error.includes('autenticado') && (
          <p className="text-lg">
            <a href={`${BACKEND_URL}/auth/google`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              Clique aqui para autenticar com o Google
            </a>
            {' '}e depois recarregue esta página.
          </p>
        )}
      </main>
    );
  }

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
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-md text-sm transition-colors cursor-pointer ${filterMode === 'all'
                ? 'bg-blue-600 text-snow'
                : 'bg-snow text-gray-700 hover:bg-gray-300'
                }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilterMode('active')}
              className={`px-3 py-1 rounded-md text-sm transition-colors cursor-pointer ${filterMode === 'active'
                ? 'bg-green-600 text-snow'
                : 'bg-snow text-gray-700 hover:bg-gray-300'
                }`}
            >
              Ativas
            </button>
            <button
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
            <div className="w-full lg:w-1/4 lg:min-w-80 h-1/4 lg:h-full overflow-y-auto flex-shrink-0">
              {getFilteredNewsletters()
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((nl) => (
                  <div
                    key={nl.messageId}
                    className={`bg-almond rounded-lg shadow-lg p-2 hover:shadow-xl transition-shadow duration-300 cursor-pointer m-1 ${!nl.isRead ? 'border-l-4 border-blue-500' : ''
                      } ${nl.isInTrash ? 'opacity-70 border-r-4 border-red-400' : ''
                      }`}
                    onClick={() => handleNewsletterClick(nl)}
                  >
                    <h2 className="text-xl lg:text-2xl font-semibold text-snow mb-2 truncate bg-bistre px-2 py-1 rounded-md">
                      {nl.subject}
                      {nl.isInTrash && <span className="text-red-500 text-sm ml-2"></span>}
                    </h2>
                    <p className="text-xs lg:text-sm text-gray-600 mb-1">
                      <b>De:</b> {nl.from.split('<')[0].trim()}
                    </p>
                    <p className="text-xs lg:text-sm text-gray-600">
                      <b>Em:</b> {new Date(nl.date).toLocaleDateString()}
                    </p>
                  </div>
                ))}
            </div>

            <div className='flex-1 p-1 overflow-x-auto h-3/4 lg:h-full'>
              {selectedNewsletter ? (
                <div className="bg-almond rounded-lg shadow-2xl p-4 lg:p-6 h-full flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg lg:text-2xl font-bold bg-bistre px-2 py-1 rounded-md text-snow truncate">
                      {selectedNewsletter.subject}
                    </h2>
                    <button
                      onClick={handleCloseModal}
                      className="text-gray-500 hover:text-gray-800 text-2xl lg:text-3xl font-bold leading-none cursor-pointer"
                    >
                      &times;
                    </button>
                  </div>
                  <p className="text-xs lg:text-sm text-gray-600 mb-2">
                    <b>De:</b> {selectedNewsletter.from.split('<')[0].trim()} | <b>Em:</b> {new Date(selectedNewsletter.date).toLocaleDateString()}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {selectedNewsletter.isRead && (
                      <button className='bg-blue-600 hover:bg-blue-700 text-snow px-3 lg:px-4 py-2 rounded-md cursor-pointer text-xs lg:text-sm'
                        onClick={() => handleAction('unread', selectedNewsletter)}>
                        Marcar como não lida
                      </button>
                    )}
                    {!selectedNewsletter.isRead && (
                      <button
                        className="bg-green-600 hover:bg-green-700 text-snow px-3 lg:px-4 py-2 rounded-md cursor-pointer text-xs lg:text-sm"
                        onClick={() => handleAction('read', selectedNewsletter)}
                      >
                        Marcar como lida
                      </button>
                    )}
                    {!selectedNewsletter.isInTrash && (
                      <button
                        className="bg-red-600 hover:bg-red-700 text-snow px-3 lg:px-4 py-2 rounded-md cursor-pointer text-xs lg:text-sm"
                        onClick={() => handleAction('trash', selectedNewsletter)}
                      >
                        Mover para a lixeira
                      </button>
                    )}
                    {selectedNewsletter.isInTrash && (
                      <button
                        className="bg-blue-600 hover:bg-blue-700 text-snow px-3 lg:px-4 py-2 rounded-md cursor-pointer text-xs lg:text-sm"
                        onClick={() => handleAction('untrash', selectedNewsletter)}
                      >
                        Restaurar da lixeira
                      </button>
                    )}
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={() => navigateNewsletter('prev')}
                        className="bg-gray-600 hover:bg-gray-700 text-snow px-3 py-2 rounded-md cursor-pointer text-xs lg:text-sm flex items-center gap-1"
                      >
                        ←
                      </button>
                      <div className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-md">
                        {(() => {
                          const filteredNewsletters = getFilteredNewsletters()
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                          const currentIndex = filteredNewsletters.findIndex(nl => nl.messageId === selectedNewsletter.messageId);
                          return `${currentIndex + 1} / ${filteredNewsletters.length}`;
                        })()}
                      </div>
                      <button
                        onClick={() => navigateNewsletter('next')}
                        className="bg-gray-600 hover:bg-gray-700 text-snow px-3 py-2 rounded-md cursor-pointer text-xs lg:text-sm flex items-center gap-1"
                      >
                        →
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 p-2 lg:p-4 rounded-md overflow-y-auto bg-bistre text-black">
                    <div className='email-wrapper'
                      dangerouslySetInnerHTML={{ __html: selectedNewsletter.cleanedHtml }} />
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-black">
                  <p className="text-lg">Selecione uma newsletter para visualizar</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}