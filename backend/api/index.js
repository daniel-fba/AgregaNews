require('dotenv').config();

const express = require('express');
const { google } = require('googleapis');
const cheerio = require('cheerio');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

let dbPromise = null;

// Habilita o CORS para permitir requisições do frontend
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Configuração do cliente OAuth2 para autenticação com a API do Google
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

function getDatabase() {
    if (!dbPromise) {
        dbPromise = initializeDatabase();
    }
    return dbPromise;
}

async function initializeDatabase() {
    try {
        // Define o caminho do banco de dados de forma diferente para produção (Vercel usa /tmp) e desenvolvimento
        const dbPath = process.env.NODE_ENV === 'production'
            ? '/tmp'
            : path.join(__dirname, '..', 'database');

        // Em desenvolvimento, cria o diretório do banco de dados se ele não existir
        if (process.env.NODE_ENV !== 'production') {
            require('fs').mkdirSync(dbPath, { recursive: true });
        }

        const dbFilename = path.join(dbPath, 'usersTokens.sqlite');

        const db = await open({
            filename: dbFilename,
            driver: sqlite3.Database
        });

        await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            userId TEXT PRIMARY KEY,
            accessToken TEXT,
            refreshToken TEXT,
            expiryDate INTEGER
            );
            `);
        console.log('Banco de dados inicializado em:', dbFilename);
        return db;
    } catch (error) {
        console.error('Erro ao inicializar o banco de dados:', error);
        throw error;
    }
}

// Carrega as credenciais do usuário do banco de dados e configura um cliente OAuth2 específico para ele
const loadUser = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'ID do usuário não fornecido no header.' });
    }

    // Extrai o userId do header 'Authorization: Bearer <userId>'
    const userId = authHeader.split(' ')[1];
    req.userId = userId;

    try {
        const db = await getDatabase();
        const user = await db.get('SELECT * FROM users WHERE userId = ?', userId);

        if (!user || !user.accessToken) {
            return res.status(401).json({ success: false, error: 'Usuário não autenticado. Por favor, autentique-se.' });
        }

        // Cria um novo cliente OAuth2 para o usuário da requisição
        const userOauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        userOauth2Client.setCredentials({
            access_token: user.accessToken,
            refresh_token: user.refreshToken,
            expiry_date: user.expiryDate,
        });

        // Anexa o cliente OAuth2 configurado ao objeto da requisição
        req.userOauth2Client = userOauth2Client;
        next();

    } catch (error) {
        console.error('Erro ao carregar credenciais do usuário:', error);
        return res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
    }
};

// Decodifica uma string em Base64Url (usada pela API do Gmail).
function decodeBase64Url(base64Url) {
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf-8');
}

function cleanHtmlContent(htmlContent) {
    if (!htmlContent) return '';

    const $ = cheerio.load(htmlContent);

    // Remove tags que não são de conteúdo (scripts, styles, etc.)
    $('script, style, link, meta').remove();
    // $('img[src*="pixel"], img[src*="tracker"]').remove(); // Remove pixels de rastreamento
    // $('[aria-label="unsubscribe"], [href*="unsubscribe"]').remove(); // Remove links de cancelamento de inscrição
    // $('[class*="ad"], [id*="ad"]').remove(); // Remove elementos de anúncio

    return $.html();
}

app.get("/api", (req, res) => res.send("Servidor do AgregaNews"));

// Rota para iniciar a autenticação do Google
app.get('/api/auth/google', (req, res) => {
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).json({ success: false, error: 'ID do usuário não fornecido.' });
    }

    const scopes = [
        'https://www.googleapis.com/auth/gmail.modify', // Permissão para ler e modificar e-mails
    ];

    // Gera a URL de autorização do Google
    const authorizationUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Solicita um refresh_token
        scope: scopes,
        prompt: 'consent',
        state: userId // Passa o userId para a rota de callback
    });

    res.redirect(authorizationUrl);
});

// Aplica o middleware loadUser a todas as rotas /api/gmail
app.use('/api/gmail', loadUser);

// Rota para buscar as mensagens do usuário
app.get('/api/gmail/messages', async (req, res) => {
    const userGmail = google.gmail({ version: 'v1', auth: req.userOauth2Client });

    try {
        // Busca e-mails na caixa de entrada e na lixeira simultaneamente
        const [activeMessages, trashMessages] = await Promise.all([
            userGmail.users.messages.list({
                userId: 'me',
                maxResults: 50,
                q: '(category:promotions OR label:newsletter OR from:noreply OR from:newsletter OR subject:unsubscribe) -in:spam -in:trash'
            }),
            userGmail.users.messages.list({
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
                const messageDetails = await userGmail.users.messages.get({
                    userId: 'me',
                    id: msg.id,
                    format: 'full'
                });

                const payload = messageDetails.data.payload;
                const messageLabelIds = messageDetails.data.labelIds || [];

                // Extrai o conteúdo HTML do corpo do e-mail
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
                    // Limpa o HTML. Para e-mails na lixeira, trunca para economizar espaço no cache.
                    const cleanedHtml = isInTrash ?
                        cleanHtmlContent(htmlContent).substring(0, 10000) :
                        cleanHtmlContent(htmlContent);

                    const subjectHeader = payload.headers.find(h => h.name === 'Subject');
                    const senderHeader = payload.headers.find(h => h.name === 'From');
                    const dateHeader = payload.headers.find(h => h.name === 'Date');

                    // Monta o objeto da newsletter
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

        // Ordena as newsletters por data decrescente: primeiro as ativas, depois as da lixeira
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

// Rota de callback do OAuth2 do Google
app.get('/api/oauth2callback', async (req, res) => {
    const { code, state } = req.query;
    const userId = state; // O userId foi passado pelo parâmetro 'state'

    if (!code) {
        return res.status(400).send('Código de autorização não fornecido.');
    }
    if (!userId) {
        return res.status(400).send('ID do usuário não fornecido.');
    }

    try {
        const db = await getDatabase();
        // Troca o código de autorização por tokens de acesso e de atualização
        const { tokens } = await oauth2Client.getToken(code);

        let refreshTokenToSave = tokens.refresh_token;
        if (!refreshTokenToSave) {
            const existingUser = await db.get('SELECT refreshToken FROM users WHERE userId = ?', userId);
            refreshTokenToSave = existingUser ? existingUser.refreshToken : null;
        }

        await db.run(
            `INSERT INTO users (userId, accessToken, refreshToken, expiryDate) VALUES (?, ?, ?, ?)
             ON CONFLICT(userId) DO UPDATE SET
                accessToken = excluded.accessToken,
                refreshToken = excluded.refreshToken,
                expiryDate = excluded.expiryDate;`,
            [userId, tokens.access_token, refreshTokenToSave, tokens.expiry_date]
        );

        console.log(`Tokens salvos no banco de dados para o usuário: ${userId}`);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/?userId=${userId}`);
    } catch (error) {
        console.error('Erro na autenticação:', error);
        res.status(500).send('Erro na autenticação.');
    }
});

// Rota para marcar uma mensagem como lida (remove 'UNREAD')
app.post('/api/gmail/messages/:messageId/read', async (req, res) => {
    const userGmail = google.gmail({ version: 'v1', auth: req.userOauth2Client });

    try {
        const { messageId } = req.params;
        await userGmail.users.messages.modify({ userId: 'me', id: messageId, resource: { removeLabelIds: ['UNREAD'] } });
        res.json({ success: true });
    } catch (error) {
        console.error('Erro na rota de marcar como lida:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota para mover uma mensagem para a lixeira
app.post('/api/gmail/messages/:messageId/trash', async (req, res) => {
    const userGmail = google.gmail({ version: 'v1', auth: req.userOauth2Client });
    try {
        const { messageId } = req.params;
        await userGmail.users.messages.trash({ userId: 'me', id: messageId });
        res.json({ success: true });
    } catch (error) {
        console.error('Erro na rota de mover para lixeira:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota para restaurar uma mensagem da lixeira
app.post('/api/gmail/messages/:messageId/untrash', async (req, res) => {
    const userGmail = google.gmail({ version: 'v1', auth: req.userOauth2Client });
    try {
        const { messageId } = req.params;
        await userGmail.users.messages.untrash({ userId: 'me', id: messageId });
        res.json({ success: true });
    } catch (error) {
        console.error('Erro na rota de restaurar da lixeira:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rota para marcar uma mensagem como não lida (adiciona 'UNREAD')
app.post('/api/gmail/messages/:messageId/unread', async (req, res) => {
    const userGmail = google.gmail({ version: 'v1', auth: req.userOauth2Client });
    try {
        const { messageId } = req.params;
        await userGmail.users.messages.modify({ userId: 'me', id: messageId, resource: { addLabelIds: ['UNREAD'] } });
        res.json({ success: true });
    } catch (error) {
        console.error('Erro na rota de marcar como não lida:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    getDatabase().then(() => {
        app.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT}`);
        });
    }).catch(err => {
        console.error('Falha ao inicializar o servidor:', err);
        process.exit(1);
    });
}

// Exporta o app para ser usado pelo ambiente serverless do Vercel
module.exports = app;