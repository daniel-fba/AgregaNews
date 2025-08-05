require('dotenv').config();

const express = require('express');
const { google } = require('googleapis');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

const gmail = google.gmail({
    version: 'v1',
    auth: oauth2Client
});

let tokenCache = {
    accessToken: null,
    refreshToken: null,
    expiryDate: null,
    scope: null
};

let newslettersCache = new Map();

async function loadTokensAndOAuth() {
    if (tokenCache.refreshToken || tokenCache.accessToken) {
        const credentials = {
            access_token: tokenCache.accessToken,
            refresh_token: tokenCache.refreshToken,
            scope: tokenCache.scope,
            token_type: 'Bearer',
            expiry_date: tokenCache.expiryDate
        };
        oauth2Client.setCredentials(credentials);
        console.log('Tokens carregados do cache em memória.');
    } else {
        console.log('Nenhum token encontrado no cache. Autenticação necessária.');
    }
}

oauth2Client.on('tokens', async (tokens) => {
    tokenCache.accessToken = tokens.access_token;
    tokenCache.scope = tokens.scope;
    tokenCache.expiryDate = tokens.expiry_date;

    if (tokens.refresh_token) {
        tokenCache.refreshToken = tokens.refresh_token;
    }

    console.log('Tokens atualizados no cache.');
    oauth2Client.setCredentials(tokens);
});

function decodeBase64Url(base64Url) {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf-8');
}

function cleanHtmlContent(htmlContent) {
    if (!htmlContent) return '';

    const $ = cheerio.load(htmlContent);

    $('script, style, link, meta').remove();
    // $('img[src*="pixel"], img[src*="tracker"]').remove();
    // $('[aria-label="unsubscribe"], [href*="unsubscribe"]').remove();
    // $('[class*="ad"], [id*="ad"]').remove();

    return $.html();
}

async function markAsUnread(messageId) {
    try {
        await gmail.users.messages.modify({
            userId: 'me',
            id: messageId,
            resource: {
                addLabelIds: ['UNREAD']
            }
        });
        console.log(`Mensagem ${messageId} marcada como não lida.`);
        return { success: true };
    } catch (error) {
        console.error('Erro ao marcar mensagem como não lida:', error);
        return { success: false, error: error.message };
    }
}

async function markAsRead(messageId) {
    try {
        await gmail.users.messages.modify({
            userId: 'me',
            id: messageId,
            resource: {
                removeLabelIds: ['UNREAD']
            }
        });
        console.log(`Mensagem ${messageId} marcada como lida.`);
        return { success: true };
    } catch (error) {
        console.error('Erro ao marcar mensagem como lida:', error);
        return { success: false, error: error.message };
    }
}

async function unTrash(messageId) {
    try {
        await gmail.users.messages.untrash({
            userId: 'me',
            id: messageId
        });
        console.log(`Mensagem ${messageId} restaurada da lixeira.`);
        return { success: true };
    } catch (error) {
        console.error('Erro ao restaurar mensagem da lixeira:', error);
        return { success: false, error: error.message };
    }
}

async function toTrashBin(messageId) {
    try {
        await gmail.users.messages.trash({
            userId: 'me',
            id: messageId
        });
        console.log(`Mensagem ${messageId} movida para a lixeira.`);
        return { success: true };
    } catch (error) {
        console.error('Erro ao mover mensagem para a lixeira:', error);
        return { success: false, error: error.message };
    }
}

app.get('/', (req, res) => {
    res.send('Backend do Agregador de Newsletters!');
});

app.get('/auth/google', (req, res) => {
    const scopes = [
        'https://www.googleapis.com/auth/gmail.modify',
    ];

    const authorizationUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
    });

    res.redirect(authorizationUrl);
});

app.get('/api/gmail/messages', async (req, res) => {
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
        return res.status(401).send('Usuário não autenticado. Por favor, faça login.');
    }

    try {
        const [activeMessages, trashMessages] = await Promise.all([
            gmail.users.messages.list({
                userId: 'me',
                maxResults: 50,
                q: '(category:promotions OR label:newsletter OR from:noreply OR from:newsletter OR subject:unsubscribe) -in:spam -in:trash'
            }),
            gmail.users.messages.list({
                userId: 'me',
                maxResults: 50,
                q: '(category:promotions OR label:newsletter OR from:noreply OR from:newsletter OR subject:unsubscribe) in:trash'
            })
        ]);

        const allMessages = [
            ...(activeMessages.data.messages || []),
            ...(trashMessages.data.messages || [])
        ];

        const processedNewsletters = [];

        if (allMessages && allMessages.length > 0) {
            for (const msg of allMessages) {
                const messageDetails = await gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id,
                    format: 'full'
                });

                const payload = messageDetails.data.payload;
                const messageLabelIds = messageDetails.data.labelIds || [];

                let htmlContent = '';
                if (payload.parts) {
                    const htmlPart = payload.parts.find(part => part.mimeType === 'text/html' && part.body && part.body.data);
                    if (htmlPart) {
                        htmlContent = decodeBase64Url(htmlPart.body.data);
                    }
                } else if (payload.body && payload.body.data && payload.mimeType === 'text/html') {
                    htmlContent = decodeBase64Url(payload.body.data);
                }

                if (htmlContent) {
                    const isInTrash = messageLabelIds.includes('TRASH');
                    const cleanedHtml = isInTrash ?
                        cleanHtmlContent(htmlContent).substring(0, 10000) :
                        cleanHtmlContent(htmlContent);

                    const subjectHeader = payload.headers.find(h => h.name === 'Subject');
                    const senderHeader = payload.headers.find(h => h.name === 'From');
                    const dateHeader = payload.headers.find(h => h.name === 'Date');

                    const newsletterData = {
                        messageId: msg.id,
                        subject: subjectHeader ? subjectHeader.value : 'Sem assunto',
                        from: senderHeader ? senderHeader.value : 'Desconhecido',
                        date: dateHeader ? new Date(dateHeader.value) : new Date(),
                        originalHtml: isInTrash ? '' : htmlContent,
                        cleanedHtml: cleanedHtml,
                        labels: messageLabelIds,
                        isRead: !messageLabelIds.includes('UNREAD'),
                        isInTrash: isInTrash,
                    };

                    processedNewsletters.push(newsletterData);
                }
            }
        }

        processedNewsletters.sort((a, b) => {
            if (a.isInTrash !== b.isInTrash) {
                return a.isInTrash ? 1 : -1;
            }
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });

        res.json({
            message: `${processedNewsletters.length} newsletters encontradas (${processedNewsletters.filter(n => !n.isInTrash).length} ativas, ${processedNewsletters.filter(n => n.isInTrash).length} na lixeira)`,
            newsletters: processedNewsletters
        });

    } catch (error) {
        console.error('Erro ao buscar e-mails:', error);
        if (error.code === 401
            || error.code === 403
            || error.message.includes('no refresh token is set')
            || error.message.includes('invalid_grant') 
        ) {
            res.status(401).send('Sua sessão expirou. Por favor, reautentique.');
        } else {
            res.status(500).send('Erro ao buscar e-mails: ' + error.message);
        }
    }
});

app.get('/oauth2callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send('Código de autorização não fornecido.');
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);

        tokenCache.accessToken = tokens.access_token;
        tokenCache.expiryDate = tokens.expiry_date;
        tokenCache.scope = tokens.scope;

        if (tokens.refresh_token) {
            tokenCache.refreshToken = tokens.refresh_token;
        }

        oauth2Client.setCredentials(tokens);

        console.log('Tokens obtidos e salvos no cache:', tokenCache);
        res.send('Autenticação bem-sucedida! Você pode fechar esta página.');

    } catch (error) {
        console.error('Erro na autenticação:', error);
        res.status(500).send('Erro na autenticação.');
    }
});

app.post('/api/gmail/messages/:messageId/read', async (req, res) => {
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado.' });
    }

    try {
        const { messageId } = req.params;
        const result = await markAsRead(messageId);
        res.json(result);
    } catch (error) {
        console.error('Erro na rota de marcar como lida:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/gmail/messages/:messageId/trash', async (req, res) => {
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado.' });
    }

    try {
        const { messageId } = req.params;
        const result = await toTrashBin(messageId);
        res.json(result);
    } catch (error) {
        console.error('Erro na rota de mover para lixeira:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/gmail/messages/:messageId/untrash', async (req, res) => {
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado.' });
    }

    try {
        const { messageId } = req.params;
        const result = await unTrash(messageId);
        res.json(result);
    } catch (error) {
        console.error('Erro na rota de restaurar da lixeira:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/gmail/messages/:messageId/unread', async (req, res) => {
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado.' });
    }

    try {
        const { messageId } = req.params;
        const result = await markAsUnread(messageId);
        res.json(result);
    } catch (error) {
        console.error('Erro na rota de marcar como não lida:', error);
        res.status(500).json({ success: false, error: error.message });
    }
})

async function startServer() {
    await loadTokensAndOAuth();
    app.listen(PORT, () => {
        console.log(`Servidor rodando em http://localhost:${PORT}`);
        console.log(`Acesse: http://localhost:${PORT}`);
        if (!oauth2Client.credentials || !oauth2Client.credentials.accessToken) {
            console.log(`Para iniciar autenticação: http://localhost:${PORT}/auth/google`);
        }
        console.log(`Para buscar newsletters (após autenticar): http://localhost:${PORT}/api/gmail/messages`);
    });
}

startServer();