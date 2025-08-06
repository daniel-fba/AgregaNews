'use client';

import { Newsletter } from '../types/newsletter';
import Image from 'next/image';
import { } from '../lib/apiHandlers';

interface NewsletterListProps {
    newsletters: Newsletter[];
    onSelectNewsletter: (newsletter: Newsletter) => void;
    onAction: (action: 'read' | 'unread' | 'trash' | 'untrash', newsletter: Newsletter) => void;
    selectedNewsletter: Newsletter | null;
}

export function NewsletterList({
    newsletters,
    onSelectNewsletter,
    onAction,
}: NewsletterListProps) {
    const sortedNewsletters = newsletters.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="w-full lg:w-1/4 lg:min-w-80 h-1/4 lg:h-full overflow-y-auto flex-shrink-0">
            {sortedNewsletters.map((nl) => (
                <div
                    key={nl.messageId}
                    className={`bg-almond hover:bg-bistre group rounded-lg shadow-lg p-2 hover:shadow-xl transition-shadow duration-300 cursor-pointer m-1 
                        ${!nl.isRead ? 'border-l-4 border-blue-500' : ''
                        } 
                        ${nl.isInTrash ? 'opacity-70 border-r-4 border-red-400' : ''
                        }`}
                    onClick={() => onSelectNewsletter(nl)}
                >
                    <div className="flex mb-2 gap-1 relative">
                        <h2 className="text-xl lg:text-2xl font-semibold text-snow mb-2 truncate bg-bistre px-2 py-1 rounded-md">
                            {nl.subject}
                            {nl.isInTrash && <span className="text-red-500 text-sm ml-2"></span>}
                        </h2>
                        <button
                            type="button"
                            title="Marcar como lida"
                            aria-label="Marcar como lida"
                            className="absolute rounded-2xl p-2 -bottom-12 right-12 lg:-bottom-14 lg:right-12 opacity-0 group-hover:opacity-100 cursor-pointer bg-blue-700 hover:bg-blue-800 text-gray-600 flex items-center justify-center transition-opacity duration-200"
                            onClick={(e) => {
                                e.stopPropagation();
                                onAction('read', nl);
                            }}
                        >
                            <Image src="/mark-email-read.png" alt="Marcar como lida" className="w-6 h-6" width={24} height={24} />
                        </button>
                        <button
                            type="button"
                            title={nl.isInTrash ? "Restaurar" : "Excluir"}
                            aria-label={nl.isInTrash ? "Restaurar item da lixeira" : "Mover para lixeira"}
                            className="absolute rounded-2xl p-2 -bottom-12 right-0 lg:-bottom-14 lg:right-0 opacity-0 group-hover:opacity-100 cursor-pointer bg-red-700 hover:bg-red-800 text-gray-600 flex items-center justify-center transition-opacity duration-200"
                            onClick={(e) => {
                                e.stopPropagation();
                                onAction(nl.isInTrash ? 'untrash' : 'trash', nl);
                            }}
                        >
                            <Image src="/delete.png" alt="Excluir" className="w-6 h-6" width={24} height={24} />
                        </button>
                    </div>
                    <p className="text-xs lg:text-sm group-hover:text-white text-gray-600 mb-1">
                        <b>De:</b> {nl.from.split('<')[0].trim()}
                    </p>
                    <p className="text-xs lg:text-sm group-hover:text-white text-gray-600">
                        <b>Em:</b> {new Date(nl.date).toLocaleDateString()}
                    </p>
                </div>
            ))}
        </div>
    )
}



