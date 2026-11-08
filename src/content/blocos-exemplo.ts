/**
 * Um exemplo de CADA formato de bloco da landing, com dados de mentira. É o
 * que a página `/blocos` mostra (src/routes/blocos.tsx).
 *
 * Para usar um formato na sua landing: ache o bloco aqui, copie o objeto de
 * `exemplo` para a lista em `src/content/landing.ts` e troque o texto.
 *
 * O tipo de `blocosExemplo` exige uma entrada para cada `type` de
 * `src/components/landing/types.ts`: criou um formato novo e esqueceu o
 * exemplo, o typecheck reclama. A ordem aqui é a ordem da página.
 */
import { CloudIcon, DatabaseIcon } from 'lucide-react'
import type { BlockOf, LandingBlock } from '#/components/landing/types'

type Catalogo = {
  [K in LandingBlock['type']]: {
    /** Uma linha: para que serve o formato. */
    descricao: string
    exemplo: BlockOf<K>
  }
}

// Um logo de exemplo em SVG como string. `currentColor` herda a cor do
// texto, então ele acompanha o tema (claro, escuro, os quatro visuais).
const logoQuadrado =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 12h6"/></svg>'
const logoCirculo =
  '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9"/></svg>'

export const blocosExemplo: Catalogo = {
  hero: {
    descricao: 'A primeira tela: promessa, uma linha de apoio e dois botões.',
    exemplo: {
      type: 'hero',
      kicker: 'Agenda para clínicas',
      title: 'Sua agenda cheia sem ficar no WhatsApp o dia todo.',
      subtitle:
        'O paciente marca sozinho, recebe o lembrete e confirma. Você só abre o painel de manhã.',
      primary: { label: 'Testar grátis', to: '/login' },
      secondary: { label: 'Ver como funciona', to: '#como-usar' },
      note: 'Sete dias grátis. Sem cartão.',
    },
  },
  stats: {
    descricao:
      'Faixa de números grandes com rótulo. Só número que dá para conferir.',
    exemplo: {
      type: 'stats',
      items: [
        { value: '312', label: 'consultas marcadas no último mês.' },
        { value: '2 min', label: 'para o paciente marcar, do link ao fim.' },
        { value: '−40%', label: 'de faltas depois do lembrete automático.' },
        { value: '0', label: 'mensagens suas para confirmar horário.' },
      ],
    },
  },
  stack: {
    descricao: 'Uma fileira de nomes em pílulas, logo abaixo do hero.',
    exemplo: {
      type: 'stack',
      label: 'Conversa com o que você já usa',
      items: ['WhatsApp', 'Google Agenda', 'Pix', 'E-mail'],
    },
  },
  logos: {
    descricao:
      'Faixa de clientes, parceiros ou tecnologias, em texto com SVG opcional; pode ser agrupada.',
    exemplo: {
      type: 'logos',
      label: 'Quem já usa (nomes de exemplo)',
      items: [
        { name: 'Clínica Sorriso', svg: logoCirculo },
        { name: 'Studio Pilates Bem', svg: logoQuadrado },
        { name: 'Dra. Ana Lima' },
        { name: 'Fisio Centro', svg: CloudIcon },
        { name: 'Consultório Vida', svg: DatabaseIcon },
      ],
    },
  },
  features: {
    descricao:
      'Cartões iguais, três por linha, cada um com uma peça do produto.',
    exemplo: {
      type: 'features',
      kicker: 'O que vem junto',
      title: 'O básico que toda clínica precisa, sem planilha.',
      items: [
        {
          title: 'Link de agendamento',
          body: 'Um endereço seu para colar no Instagram e no Google.',
        },
        {
          title: 'Lembrete automático',
          body: 'Um dia antes, por e-mail. O paciente confirma com um clique.',
        },
        {
          title: 'Painel do dia',
          body: 'Quem vem, quem confirmou e quem ainda não respondeu.',
        },
      ],
    },
  },
  bento: {
    descricao:
      'Grade de cartões de tamanhos diferentes; o cartão largo ou destacado puxa o olho.',
    exemplo: {
      type: 'bento',
      kicker: 'Por dentro',
      title: 'Um cartão grande para o que importa, os pequenos para o resto.',
      items: [
        {
          span: 4,
          featured: true,
          icon: 'clock',
          title: 'Agenda que se preenche sozinha',
          body: 'O paciente vê os horários livres e escolhe. Nada de "tem horário quinta?" no WhatsApp.',
        },
        {
          span: 2,
          icon: 'bell',
          title: 'Lembrete',
          body: 'Sai um dia antes, sem você lembrar.',
        },
        {
          span: 2,
          icon: 'users',
          title: 'Ficha do paciente',
          body: 'Histórico e contato num lugar só.',
        },
        {
          span: 2,
          icon: 'chart',
          title: 'Relatório do mês',
          body: 'Quantas consultas, quantas faltas.',
        },
        {
          span: 2,
          icon: 'shield',
          title: 'Dados protegidos',
          body: 'Cada clínica só vê o que é dela.',
        },
        {
          span: 6,
          icon: 'code',
          title: 'Onde mexer',
          body: 'Este bloco vem de um arquivo de dados. Mude o span de cada cartão para mudar o desenho da grade.',
          path: 'src/content/blocos-exemplo.ts',
        },
      ],
    },
  },
  compare: {
    descricao:
      'Duas colunas, "antes / depois" ou "eles / nós"; a direita ganha a marca.',
    exemplo: {
      type: 'compare',
      kicker: 'Antes e depois',
      title: 'O que muda na semana da recepção.',
      before: {
        label: 'Sem a agenda',
        items: [
          'Resposta no WhatsApp até às 22h.',
          'Paciente esquece e não avisa.',
          'Caderno, planilha e post-it.',
        ],
      },
      after: {
        label: 'Com a agenda',
        items: [
          'O paciente marca sozinho, a qualquer hora.',
          'Lembrete automático um dia antes.',
          'Tudo num painel, no celular ou no computador.',
        ],
      },
    },
  },
  steps: {
    descricao: 'Passos numerados, cada um com um bloco de comandos.',
    exemplo: {
      type: 'steps',
      kicker: 'Como começa',
      title: 'Três passos até a primeira consulta marcada.',
      steps: [
        {
          title: 'Crie a conta',
          body: 'Entre com o e-mail. Chega um código, você digita e pronto.',
          lines: ['/login'],
        },
        {
          title: 'Monte os horários',
          body: 'Dias da semana, duração da consulta e intervalos.',
          lines: ['/app/configuracoes'],
        },
        {
          title: 'Divulgue o link',
          body: 'Cole na bio, no Google e na mensagem de boas-vindas.',
          lines: ['sua-clinica.exemplo.com'],
        },
      ],
    },
  },
  terminal: {
    descricao:
      'Janela de terminal com comandos "digitados" ao aparecer; respeita quem pediu menos movimento.',
    exemplo: {
      type: 'terminal',
      kicker: 'Na sua máquina',
      title: 'Do clone ao app rodando, em três comandos.',
      label: '~/meu-app',
      lines: [
        'npm install',
        { out: 'added 812 packages in 21s' },
        'npm run db:migrate:local',
        { ok: '✔ Migrations applied' },
        'npm run dev',
        { out: 'VITE ready in 900 ms' },
        { out: '➜  Local: http://localhost:3000/' },
      ],
    },
  },
  gallery: {
    descricao:
      'Grade de imagens da pasta public, com legenda e carregamento preguiçoso.',
    exemplo: {
      type: 'gallery',
      kicker: 'Telas',
      title: 'Como fica na prática.',
      items: [
        {
          src: '/galeria/painel.svg',
          alt: 'Painel com barra lateral, três números e um gráfico de barras',
          width: 800,
          height: 600,
          caption: 'O painel do dia.',
        },
        {
          src: '/galeria/login.svg',
          alt: 'Tela de login com campo de e-mail e botão de entrar',
          width: 800,
          height: 600,
          caption: 'Login por código no e-mail.',
        },
        {
          src: '/galeria/blog.svg',
          alt: 'Página de artigo com título e parágrafos',
          width: 800,
          height: 600,
          caption: 'Blog para aparecer no Google.',
        },
      ],
    },
  },
  testimonials: {
    descricao: 'Depoimentos em cartões, com iniciais no lugar da foto.',
    exemplo: {
      type: 'testimonials',
      kicker: 'Quem usa',
      title: 'O que dizem depois do primeiro mês (exemplos).',
      items: [
        {
          quote: 'Parei de responder horário no WhatsApp à noite.',
          name: 'Nome da pessoa',
          role: 'Exemplo: dentista',
          initials: 'NP',
        },
        {
          quote: 'As faltas caíram já na primeira semana.',
          name: 'Nome da pessoa',
          role: 'Exemplo: fisioterapeuta',
          initials: 'NP',
        },
        {
          quote: 'A recepção ganhou uma manhã por semana.',
          name: 'Nome da pessoa',
          role: 'Exemplo: dona de clínica',
          initials: 'NP',
        },
      ],
    },
  },
  faq: {
    descricao: 'Perguntas que abrem e fecham, ao lado do título.',
    exemplo: {
      type: 'faq',
      kicker: 'Dúvidas',
      title: 'O que perguntam antes de assinar.',
      items: [
        {
          q: 'Preciso instalar alguma coisa?',
          a: 'Não. Funciona no navegador, no celular e no computador.',
        },
        {
          q: 'O paciente precisa criar conta?',
          a: 'Não. Ele escolhe o horário e informa nome e e-mail.',
        },
      ],
    },
  },
  cta: {
    descricao: 'A última frase da página e o botão que vem junto.',
    exemplo: {
      type: 'cta',
      title: 'Bora encher essa agenda?',
      primary: { label: 'Testar grátis', to: '/login' },
      secondary: { label: 'Falar com a gente', to: '/docs' },
    },
  },
}

/** Os 13 formatos na ordem da página, prontos para `.map`. */
export const blocosCatalogo = (
  Object.keys(blocosExemplo) as LandingBlock['type'][]
).map((type) => ({ type, ...blocosExemplo[type] }))
