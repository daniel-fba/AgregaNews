# AgregaNews

AgregaNews é um portal agregador de newsletters que se sincroniza com sua conta do Gmail, permitindo uma visualização limpa, organizada e centralizada de todas as suas inscrições.

## 🌐 Acesso Online

Você pode acessar a versão de produção do projeto aqui:
**[https://agreganews.vercel.app/](https://agreganews.vercel.app/)**

## 🚀 Funcionalidades

- ✅ **Integração com Gmail API:** Sincroniza suas newsletters diretamente da sua caixa de entrada.
- ✅ **Cache Local:** Utiliza `localStorage` para uma experiência de usuário rápida e para acesso offline, com gerenciamento de tamanho para evitar sobrecarga.
- ✅ **Filtros de Visualização:** Organize suas newsletters por Ativas, Lixeira ou Todas.
- ✅ **Ações Rápidas:** Marque como lida/não lida, mova para a lixeira e restaure e-mails diretamente da interface.
- ✅ **Interface Responsiva:** Construído com Tailwind CSS para uma ótima experiência em qualquer dispositivo.

## 🛠️ Tecnologias Utilizadas

-   **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
-   **Backend:** Node.js, Express.js
-   **API:** Google Gmail API para autenticação e busca de e-mails.
-   **Banco de Dados:** SQLite para armazenar tokens de autenticação dos usuários.
-   **Hospedagem:** Vercel

## ⚙️ Configuração e Instalação Local

Siga os passos abaixo para configurar e rodar o projeto em seu ambiente local.

### Pré-requisitos

-   Node.js (versão 18 ou superior)
-   `npm` ou `yarn`
-   Credenciais da API do Google (Client ID e Client Secret). Você pode obtê-las no [Google Cloud Console](https://console.cloud.google.com/).

### 1. Backend

Primeiro, configure e inicie o servidor backend.

```bash
# 1. Navegue até o diretório do backend
cd backend

# 2. Instale as dependências
npm install

# 3. Crie um arquivo .env na raiz de /backend e adicione as seguintes variáveis:
# Substitua pelos seus próprios valores obtidos do Google Cloud Console
```

**Arquivo `backend/.env`:**

```env
# Credenciais do Google OAuth 2.0
GOOGLE_CLIENT_ID="SEU_CLIENT_ID_DO_GOOGLE"
GOOGLE_CLIENT_SECRET="SEU_CLIENT_SECRET_DO_GOOGLE"

# URI de redirecionamento configurada no seu projeto Google Cloud.
# Para desenvolvimento local, deve ser a URL do seu backend + /api/oauth2callback
GOOGLE_REDIRECT_URI="http://localhost:3001/api/oauth2callback"

# URL do seu frontend para redirecionamento após o login
FRONTEND_URL="http://localhost:3000"

# Porta em que o servidor backend irá rodar
PORT=3001
```

```bash
# 4. Inicie o servidor backend
npm start
# ou
node api/index.js
```

O servidor backend estará rodando em `http://localhost:3001`.

### 2. Frontend

Agora, configure e inicie a aplicação frontend.

```bash
# 1. Em um novo terminal, navegue até o diretório do frontend
cd frontend

# 2. Instale as dependências
npm install

# 3. Crie um arquivo .env.local na raiz de /frontend e adicione a seguinte variável:
```

**Arquivo `frontend/.env.local`:**

```env
# URL para o seu servidor backend local
NEXT_PUBLIC_BACKEND_URL="http://localhost:3001"
```

```bash
# 4. Inicie o servidor de desenvolvimento do Next.js
npm run dev
```

### 3. Acesso

Após iniciar ambos os servidores, abra o navegador e acesse **[http://localhost:3000](http://localhost:3000)** para usar a aplicação localmente.