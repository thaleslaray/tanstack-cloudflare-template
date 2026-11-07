/**
 * A landing page, como dados.
 *
 * ESTE ARQUIVO É PARA VOCÊ REESCREVER. O texto abaixo é a apresentação do
 * próprio template; nada dele é seu produto. A rota que renderiza
 * (`src/routes/index.tsx`) não tem texto nem layout: ela só percorre estes
 * blocos. Então:
 *
 *   reordenar uma seção   mova um bloco
 *   remover uma seção     apague um bloco
 *   adicionar uma seção   adicione um bloco com um dos formatos em
 *                         `src/components/landing/types.ts`
 *
 * A ORDEM conta uma história: o que é (hero), em que foi feito (stack), o que
 * já vem pronto (features), como se usa (steps), quem já usou (depoimentos),
 * o que ainda está em dúvida (faq) e a porta de saída (cta).
 */
import type { LandingBlock } from '#/components/landing/types'

export const landing: readonly LandingBlock[] = [
  {
    type: 'hero',
    kicker: 'Template full-stack na Cloudflare',
    title: 'Seu app completo no ar, sem montar quebra-cabeça.',
    subtitle:
      'Login por código no e-mail, banco de dados, arquivos, e-mail, tarefas agendadas e esta landing já vêm prontos. Você clona, roda cinco comandos e publica com um botão. O resto é o seu negócio.',
    primary: { label: 'Entrar no app', to: '/login' },
    secondary: { label: 'Ler a documentação', to: '/docs' },
    note: 'Roda inteiro em um Worker da Cloudflare. Plano gratuito dá conta do começo.',
  },

  {
    type: 'stack',
    label: 'Feito com o que você já ouviu falar',
    items: [
      'TanStack Start',
      'React 19',
      'Tailwind v4',
      'shadcn/ui',
      'Cloudflare Workers',
      'D1',
      'R2',
      'Drizzle',
      'Better Auth',
      'MDX',
    ],
  },

  {
    type: 'features',
    kicker: 'O que já vem pronto',
    title:
      'Basicamente tudo que você montaria na mão nas duas primeiras semanas.',
    items: [
      {
        title: 'Login sem senha',
        body: 'Um código de seis dígitos chega no e-mail e pronto. Google e GitHub ligam quando você colar as chaves. Senha continua existindo para quem quiser.',
        path: 'src/lib/auth.ts',
      },
      {
        title: 'Banco de dados de verdade',
        body: 'D1 (SQLite da Cloudflare) com Drizzle: você escreve o schema em TypeScript e as migrações saem sozinhas.',
        path: 'src/db/schema.ts',
      },
      {
        title: 'Arquivos no R2',
        body: 'Upload e download sem taxa de saída. Tem uma demo pronta para você copiar.',
        path: 'src/routes/demo/r2.tsx',
      },
      {
        title: 'E-mail que funciona no primeiro dia',
        body: 'Sem chave nenhuma, o e-mail aparece no terminal. Com a chave do Resend ou o Email Service da Cloudflare, vai de verdade.',
        path: 'src/lib/email.ts',
      },
      {
        title: 'Landing, blog e docs',
        body: 'Esta página é um arquivo de dados. Blog, docs, termos e privacidade são MDX e viram HTML estático na hora do build.',
        path: 'src/content/landing.ts',
      },
      {
        title: 'Proteções que ninguém lembra',
        body: 'Limite de requisições por IP, cabeçalhos de segurança e um cron diário que limpa sessões vencidas. Já ligados.',
        path: 'src/server.ts',
      },
    ],
  },

  {
    type: 'steps',
    kicker: 'Como se usa',
    title: 'Três passos. Nenhum deles é "configurar servidor".',
    steps: [
      {
        title: 'Clone e rode',
        body: 'Abra a pasta no Claude Code e peça /setup. Ele instala, cria o .dev.vars, roda a migração e sobe o app em localhost:3000.',
        lines: ['npm install', 'npm run db:migrate:local', 'npm run dev'],
      },
      {
        title: 'Faça o seu',
        body: 'Troque o texto desta página, crie suas tabelas em src/db/schema.ts e suas telas em src/routes. Os demos mostram o caminho de cada peça.',
        lines: ['src/content/landing.ts', 'src/db/schema.ts', 'src/routes/'],
      },
      {
        title: 'Publique',
        body: 'Peça /deploy. Ele cria o banco, troca o ID, sobe os segredos e publica. Ou use o botão "Deploy to Cloudflare" do README.',
        lines: ['wrangler login', 'wrangler d1 create', 'npm run deploy'],
      },
    ],
  },

  // TROQUE por depoimentos reais (com autorização de quem falou) ou apague o
  // bloco antes de publicar. Os três abaixo são exemplos marcados como tal.
  {
    type: 'testimonials',
    kicker: 'Quem já usou',
    title: 'O que dizem depois de publicar o primeiro app.',
    items: [
      {
        quote:
          'Eu achava que subir um app com login era coisa de programador. Em uma tarde o meu estava no ar.',
        name: 'Nome da pessoa',
        role: 'Exemplo: dona de clínica',
        initials: 'NP',
      },
      {
        quote:
          'O que mais me travava era o deploy. Aqui é um comando, e o resto o template já resolveu.',
        name: 'Nome da pessoa',
        role: 'Exemplo: corretor de imóveis',
        initials: 'NP',
      },
      {
        quote:
          'Peguei o template, troquei a landing, criei duas tabelas. Pronto, meu MVP para testar com clientes.',
        name: 'Nome da pessoa',
        role: 'Exemplo: consultora',
        initials: 'NP',
      },
    ],
  },

  {
    type: 'faq',
    kicker: 'Dúvidas',
    title: 'O que todo mundo pergunta antes de clonar.',
    items: [
      {
        q: 'Preciso saber programar?',
        a: 'Precisa saber pedir. O template vem com regras para o Claude Code (e outros agentes) e com skills de /setup e /deploy. Você descreve o que quer, confere o resultado e aprende no caminho.',
      },
      {
        q: 'Quanto custa manter no ar?',
        a: 'O plano gratuito da Cloudflare cobre Workers, D1 e R2 com limites generosos para um app começando. Você só paga quando crescer. E-mail de verdade precisa do Resend (tem plano grátis) ou do Email Service (plano pago da Cloudflare).',
      },
      {
        q: 'Por que Wrangler, e não o cf novo?',
        a: 'O cf é o novo CLI da Cloudflare, mas ainda está em beta. O template usa o Wrangler e o plugin do Vite v1, o caminho estável do guia oficial, com as versões fixadas no package.json. Quando o cf ficar estável, um comando (cf migrate) faz a troca.',
      },
      {
        q: 'Posso instalar o cf para testar?',
        a: 'Não neste projeto, por enquanto. A configuração vive no wrangler.jsonc, e o cf ignora esse arquivo. Misturar os dois é a forma mais rápida de quebrar o deploy.',
      },
      {
        q: 'Funciona com outro agente além do Claude Code?',
        a: 'Funciona. O CLAUDE.md e o AGENTS.md carregam as mesmas regras, e as skills são Markdown comum em .claude/skills. Codex, Cursor e afins leem o mesmo texto.',
      },
    ],
  },

  {
    type: 'cta',
    title: 'Chega de montar base. Vai fazer o seu app.',
    primary: { label: 'Entrar no app', to: '/login' },
    secondary: { label: 'Ver a documentação', to: '/docs' },
  },
]
