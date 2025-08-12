import axios from 'axios';

export const handleMarkAsRead = async (backendUrl: string, messageId: string, userId: string) => {
    try {
        const response = await axios.post(`${backendUrl}/api/gmail/messages/${messageId}/read`, {}, {
            headers: {
                'Authorization': `Bearer ${userId}`
            }
        });
        return response.data;
    } catch (error) {
        console.error('Erro ao marcar como lida:', error);
        if (axios.isAxiosError(error)) {
            return { success: false, error: error.response?.data || error.message };
        }
        return { success: false, error: 'Erro desconhecido' };
    }
};

export const handleMoveToTrash = async (backendUrl: string, messageId: string, userId: string) => {
    try {
        const response = await axios.post(`${backendUrl}/api/gmail/messages/${messageId}/trash`, {}, {
            headers: {
                'Authorization': `Bearer ${userId}`
            }
        });
        return response.data;
    } catch (error) {
        console.error('Erro ao mover para lixeira:', error);
        if (axios.isAxiosError(error)) {
            return { success: false, error: error.response?.data || error.message };
        }
        return { success: false, error: 'Erro desconhecido' };
    }
};

export const handleRestoreFromTrash = async (backendUrl: string, messageId: string, userId: string) => {
    try {
        const response = await axios.post(`${backendUrl}/api/gmail/messages/${messageId}/untrash`, {}, {
            headers: {
                'Authorization': `Bearer ${userId}`
            }
        });
        return response.data;
    } catch (error) {
        console.error('Erro ao restaurar da lixeira:', error);
        if (axios.isAxiosError(error)) {
            return { success: false, error: error.response?.data || error.message };
        }
        return { success: false, error: 'Erro desconhecido' };
    }
};

export const handleMarkAsUnread = async (backendUrl: string, messageId: string, userId: string) => {
    try {
        const response = await axios.post(`${backendUrl}/api/gmail/messages/${messageId}/unread`, {}, {
            headers: {
                'Authorization': `Bearer ${userId}`
            }
        });
        return response.data;
    } catch (error) {
        console.error('Erro ao marcar como não lida:', error);
        if (axios.isAxiosError(error)) {
            return { success: false, error: error.response?.data || error.message };
        }
        return { success: false, error: 'Erro desconhecido' };
    }
};
