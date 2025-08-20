/* eslint-disable react/no-unescaped-entities */
import Link from 'next/link';

export default function PrivacyPolicy() {
    return (
        <main className="flex min-h-screen flex-col items-center p-8 md:p-16 lg:p-24 bg-cinereous text-snow">
            <div className="max-w-4xl w-full bg-almond text-black p-8 rounded-lg shadow-lg">
                <h1 className="text-4xl font-bold mb-6 text-center">Política de Privacidade para AgregaNews</h1>

                <section className="mb-6">
                    <h2 className="text-2xl font-semibold mb-2">1. Introdução</h2>
                    <p>Esta política de privacidade explica como nós do AgregaNews ("o Aplicativo") coletamos, usamos e protegemos os dados de seus usuários. Ao usar nosso serviço, você concorda com a coleta e uso de informações de acordo com esta política.</p>
                </section>

                <section className="mb-6">
                    <h2 className="text-2xl font-semibold mb-2">2. Dados Coletados</h2>
                    <p className="mb-2">Para fornecer nossos serviços, nós nos conectamos à sua conta do Gmail para acessar e gerenciar seus e-mails. Coletamos os seguintes tipos de dados:</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Dados de Autenticação do Google:</strong> Para manter sua sessão ativa, armazenamos de forma segura os tokens de acesso, tokens de atualização e a data de expiração fornecidos pelo Google. Estes dados são associados a um identificador de usuário gerado pelo aplicativo.</li>
                        <li><strong>Conteúdo de E-mail:</strong> Acessamos o corpo HTML e os metadados (como assunto, remetente, data e marcadores, por exemplo, 'LIDO' ou 'LIXEIRA') de e-mails que correspondam a critérios de newsletter (ex: categoria "Promoções", rótulo "newsletter").</li>
                    </ul>
                </section>

                <section className="mb-6">
                    <h2 className="text-2xl font-semibold mb-2">3. Uso dos Dados</h2>
                    <p className="mb-2">Os dados coletados são usados exclusivamente para as seguintes finalidades:</p>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Autenticação e Acesso:</strong> Conectar-se de forma segura à sua conta do Gmail.</li>
                        <li><strong>Visualização Otimizada:</strong> Buscar, limpar e agregar o conteúdo de suas newsletters para apresentá-lo de forma clara no aplicativo.</li>
                        <li><strong>Gerenciamento de E-mails:</strong> Permitir que você execute ações em seus e-mails diretamente pelo aplicativo, como marcar como lido/não lido, mover para a lixeira e restaurar.</li>
                    </ul>
                </section>

                <section className="mb-6">
                    <h2 className="text-2xl font-semibold mb-2">4. Armazenamento de Dados</h2>
                    <ul className="list-disc list-inside space-y-2">
                        <li><strong>Dados de E-mail:</strong> O conteúdo dos seus e-mails é processado e mantido em cache no seu navegador. Nenhum conteúdo de e-mail é armazenado de forma persistente em nossos servidores.</li>
                        <li><strong>Dados de Autenticação:</strong> Seus tokens de autenticação e ID são armazenados em um banco de dados seguro para manter sua sessão ativa.</li>
                    </ul>
                </section>

                <section className="mb-6">
                    <h2 className="text-2xl font-semibold mb-2">5. Compartilhamento de Dados</h2>
                    <p>Nós não compartilhamos seus dados pessoais ou o conteúdo de seus e-mails com terceiros.</p>
                </section>

                <section className="mb-6">
                    <h2 className="text-2xl font-semibold mb-2">6. Seus Direitos e Controle</h2>
                    <p>Você pode revogar as permissões do Aplicativo a qualquer momento através da página de segurança da sua Conta Google.</p>
                </section>

                <section className="mb-6">
                    <h2 className="text-2xl font-semibold mb-2">7. Contato</h2>
                    <p>Para quaisquer perguntas, entre em contato pelo email danielfbalv@gmail.com.</p>
                </section>

                <div className="text-center mt-8">
                    <Link href="/" className="text-blue-600 hover:underline">
                        Voltar para a página inicial
                    </Link>
                </div>
            </div>
        </main>
    );
}