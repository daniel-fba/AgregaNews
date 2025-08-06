'use client';

import { Newsletter } from "../types/newsletter";

interface NewsletterViewerProps {
    newsletter: Newsletter | null;
    onClose: () => void;
    onAction: (action: 'read' | 'unread' | 'trash' | 'untrash', newsletter: Newsletter) => void;
    onNavigate: (direction: 'previous' | 'next') => void;
    currentIndex: number;
    totalCount: number;
}

export function NewsletterViewer({
    newsletter,
    onClose,
    onAction,
    onNavigate,
    currentIndex,
    totalCount }: NewsletterViewerProps) {
    if (!newsletter) {
        return (
            <div className="h-full flex items-center justify-center text-black">
                <p className="text-lg">Selecione uma newsletter para visualizar</p>
            </div>
        )
    }

    return (
        <div className="bg-almond rounded-lg shadow-2xl p-4 lg:p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg lg:text-2xl font-bold bg-bistre px-2 py-1 rounded-md text-snow truncate">
                    {newsletter.subject}
                </h2>
                <button
                    type='button'
                    title='Fechar visualização da newsletter'
                    aria-label='Fechar visualização da newsletter'
                    onClick={onClose}
                    className="text-gray-500 hover:text-gray-800 text-2xl lg:text-3xl font-bold leading-none cursor-pointer"
                >
                    &times;
                </button>
            </div>
            <p className="text-xs lg:text-sm text-gray-600 mb-2">
                <b>De:</b> {newsletter.from.split('<')[0].trim()} | <b>Em:</b> {new Date(newsletter.date).toLocaleDateString()}
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
                {newsletter.isRead && (
                    <button
                        type='button'
                        title='Marcar como não lida'
                        aria-label='Marcar como não lida'
                        className='bg-blue-600 hover:bg-blue-700 text-snow px-3 lg:px-4 py-2 rounded-md cursor-pointer text-xs lg:text-sm'
                        onClick={() => onAction('unread', newsletter)}>
                        Marcar como não lida
                    </button>
                )}
                {!newsletter.isRead && (
                    <button
                        type='button'
                        title='Marcar como lida'
                        aria-label='Marcar como lida'
                        className="bg-green-600 hover:bg-green-700 text-snow px-3 lg:px-4 py-2 rounded-md cursor-pointer text-xs lg:text-sm"
                        onClick={() => onAction('read', newsletter)}
                    >
                        Marcar como lida
                    </button>
                )}
                {!newsletter.isInTrash && (
                    <button
                        type='button'
                        title='Mover para a lixeira'
                        aria-label='Mover para a lixeira'
                        className="bg-red-600 hover:bg-red-700 text-snow px-3 lg:px-4 py-2 rounded-md cursor-pointer text-xs lg:text-sm"
                        onClick={() => onAction('trash', newsletter)}
                    >
                        Mover para a lixeira
                    </button>
                )}
                {newsletter.isInTrash && (
                    <button
                        type='button'
                        title='Restaurar da lixeira'
                        aria-label='Restaurar da lixeira'
                        className="bg-blue-600 hover:bg-blue-700 text-snow px-3 lg:px-4 py-2 rounded-md cursor-pointer text-xs lg:text-sm"
                        onClick={() => onAction('untrash', newsletter)}
                    >
                        Restaurar da lixeira
                    </button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                    <button
                        type='button'
                        title='Navegar para a newsletter anterior'
                        aria-label='Navegar para a newsletter anterior'
                        disabled={currentIndex === 0}
                        onClick={() => onNavigate('previous')}
                        className="bg-gray-600 hover:bg-gray-700 text-snow px-3 py-2 rounded-md cursor-pointer text-xs lg:text-sm flex items-center gap-1"
                    >
                        ←
                    </button>
                    <div className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-md">
                        {currentIndex + 1} / {totalCount}
                    </div>
                    <button
                        type='button'
                        title='Navegar para a próxima newsletter'
                        aria-label='Navegar para a próxima newsletter'
                        disabled={currentIndex === totalCount - 1}
                        onClick={() => onNavigate('next')}
                        className="bg-gray-600 hover:bg-gray-700 text-snow px-3 py-2 rounded-md cursor-pointer text-xs lg:text-sm flex items-center gap-1"
                    >
                        →
                    </button>
                </div>
            </div>
            <div className="flex-1 p-2 lg:p-4 rounded-md overflow-y-auto bg-bistre text-black">
                <div className='email-wrapper'
                    dangerouslySetInnerHTML={{ __html: newsletter.cleanedHtml }} />
            </div>
        </div>
    )
}

