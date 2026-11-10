import { createFileRoute } from '@tanstack/react-router'
import { DownloadIcon, InboxIcon, PlusIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'

import { EmptyState } from '#/components/app/empty-state'
import { ExemploLista } from '#/components/app/exemplo-lista'
import { Field } from '#/components/app/field'
import { PageSection } from '#/components/app/page-section'
import { StatusDot } from '#/components/app/status'
import { PageHeader, StatCard, StatStrip } from '#/components/page-header'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { Skeleton } from '#/components/ui/skeleton'
import { Switch } from '#/components/ui/switch'
import { Textarea } from '#/components/ui/textarea'
import { seo } from '#/lib/seo'

// A bancada do visual: as cores, a tipografia e cada peça que uma tela usa,
// no tema atual. É o par de /blocos (que mostra os blocos da landing): aqui
// ficam as peças da ÁREA LOGADA e dos formulários.
//
// Serve para duas coisas: ver se uma mudança de token ou de primitiva ficou
// boa em todos os temas, e copiar o trecho de uma peça para uma tela nova
// (é o que a skill /tela manda fazer).
//
// Como /blocos, é bancada e não página de produto: `noindex`, bloqueada no
// robots.txt (ROBOTS_DISALLOW em src/config/public-paths.ts) e fora da
// pré-renderização.
export const Route = createFileRoute('/estilo')({
  head: () => ({
    meta: seo({
      title: 'Bancada do visual',
      description: 'As cores, a tipografia e as peças de tela do app.',
      noindex: true,
    }),
  }),
  component: Bancada,
})

const SECOES = [
  { id: 'cores', rotulo: 'Cores' },
  { id: 'tipografia', rotulo: 'Tipografia' },
  { id: 'botoes', rotulo: 'Botões' },
  { id: 'formulario', rotulo: 'Formulário' },
  { id: 'estados', rotulo: 'Estados e avisos' },
  { id: 'lista', rotulo: 'Tela de lista' },
  { id: 'pagina', rotulo: 'Página da área logada' },
] as const

// Cada amostra é uma classe de token do Tailwind. A lista é escrita por
// extenso (e não montada com `bg-${nome}`) porque o Tailwind só gera a
// classe que encontra inteira no código.
const CORES = [
  { classe: 'bg-background', nome: 'background', uso: 'O chão da página.' },
  { classe: 'bg-surface', nome: 'surface', uso: 'Folha sob uma seção.' },
  { classe: 'bg-secondary', nome: 'secondary', uso: 'Preenchimento discreto.' },
  { classe: 'bg-card', nome: 'card', uso: 'Cartão e diálogo.' },
  { classe: 'bg-foreground', nome: 'foreground', uso: 'A tinta do texto.' },
  {
    classe: 'bg-muted-foreground',
    nome: 'muted-foreground',
    uso: 'Texto de apoio.',
  },
  { classe: 'bg-brand', nome: 'brand', uso: 'A marca. Só preenchimento.' },
  {
    classe: 'bg-destructive',
    nome: 'destructive',
    uso: 'Erro e ação que apaga.',
  },
  { classe: 'bg-success', nome: 'success', uso: 'Estado: deu certo.' },
  { classe: 'bg-warning', nome: 'warning', uso: 'Estado: atenção.' },
] as const

function Secao({
  id,
  titulo,
  descricao,
  children,
}: {
  id: string
  titulo: string
  descricao: ReactNode
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-label={titulo}
      className="scroll-mt-20 border-t border-border py-12"
    >
      <div className="mb-8 grid gap-2">
        <h2 className="text-xl font-semibold tracking-tight">{titulo}</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {descricao}
        </p>
      </div>
      {children}
    </section>
  )
}

// Uma fileira de peças com um rótulo pequeno em cima.
function Fileira({
  rotulo,
  children,
}: {
  rotulo: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-3">
      <p className="kicker">{rotulo}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

function Bancada() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8">
      <header className="flex flex-col gap-5 pt-16 pb-12 sm:pt-24">
        <p className="kicker">Bancada</p>
        <h1 className="font-display max-w-3xl text-4xl leading-[1.02] tracking-[var(--tracking-display)] sm:text-6xl">
          As peças de tela do app.
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Tudo que uma tela usa, no tema atual: cores, texto, botões, campos,
          estados e a tela de lista de referência. Troque o tema no topo da
          página para conferir os quatro visuais. As regras por trás estão em{' '}
          <code>src/CLAUDE.md</code>.
        </p>
        <nav aria-label="Seções">
          <ul className="flex flex-wrap gap-2">
            {SECOES.map((secao) => (
              <li key={secao.id}>
                <a
                  href={`#${secao.id}`}
                  className="inline-block rounded-[var(--radius-btn)] border border-border bg-surface px-3 py-1 text-sm text-foreground no-underline transition-colors hover:bg-secondary"
                >
                  {secao.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <Secao
        id="cores"
        titulo="Cores"
        descricao={
          <>
            Cor só entra por token: as classes abaixo, nunca um valor escrito
            num componente. O chão é neutro e a marca aparece em três lugares: o
            botão principal, o anel de foco e o que está selecionado. Os valores
            de cada tema ficam em <code>src/styles.css</code>.
          </>
        }
      >
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {CORES.map((cor) => (
            <li key={cor.nome} className="grid gap-2">
              <span
                aria-hidden="true"
                className={`h-16 rounded-[var(--radius-card)] border ${cor.classe}`}
              />
              <span className="grid gap-0.5">
                <code className="text-sm">{cor.classe}</code>
                <span className="text-sm text-muted-foreground">{cor.uso}</span>
              </span>
            </li>
          ))}
        </ul>
      </Secao>

      <Secao
        id="tipografia"
        titulo="Tipografia"
        descricao="Hierarquia vem de tamanho e de cinza, não de peso: nada passa de 600. Texto tem duas cores, a tinta e o cinza de apoio."
      >
        <div className="grid gap-6">
          <div className="grid gap-1">
            <p className="kicker">Título de landing · font-display text-4xl</p>
            <p className="font-display text-4xl leading-[1.02] tracking-[var(--tracking-display)]">
              Seu app completo no ar.
            </p>
          </div>
          <div className="grid gap-1">
            <p className="kicker">
              Título de página · text-2xl font-semibold tracking-tight
            </p>
            <p className="text-2xl font-semibold tracking-tight">
              Configurações
            </p>
          </div>
          <div className="grid gap-1">
            <p className="kicker">Título de seção · text-sm font-semibold</p>
            <p className="text-sm font-semibold">Perfil</p>
          </div>
          <div className="grid gap-1">
            <p className="kicker">Texto · text-sm</p>
            <p className="max-w-xl text-sm">
              O texto corrido da área logada. Frases curtas, uma ideia por vez.
            </p>
          </div>
          <div className="grid gap-1">
            <p className="kicker">Apoio · text-sm text-muted-foreground</p>
            <p className="max-w-xl text-sm text-muted-foreground">
              Explica o que está em cima, sem competir com ele.
            </p>
          </div>
          <div className="grid gap-1">
            <p className="kicker">Código · font-mono text-sm</p>
            <p className="font-mono text-sm">npm run dev</p>
          </div>
        </div>
      </Secao>

      <Secao
        id="botoes"
        titulo="Botões"
        descricao={
          <>
            Um botão <code>brand</code> por tela, na ação principal. O padrão é
            tinta; <code>outline</code> e <code>ghost</code> ficam para o que é
            secundário. No hover só a cor muda.
          </>
        }
      >
        <div className="grid gap-8">
          <Fileira rotulo="Variantes">
            <Button variant="brand">Salvar</Button>
            <Button>Continuar</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="outline">Cancelar</Button>
            <Button variant="ghost">Agora não</Button>
            <Button variant="destructive">Apagar</Button>
            <Button variant="link">Saiba mais</Button>
          </Fileira>
          <Fileira rotulo="Tamanhos">
            <Button size="sm">Pequeno</Button>
            <Button>Padrão</Button>
            <Button size="lg">Grande</Button>
          </Fileira>
          <Fileira rotulo="Com ícone, ocupado e desligado">
            <Button variant="brand">
              <PlusIcon />
              Novo item
            </Button>
            <Button variant="outline">
              <DownloadIcon />
              Baixar
            </Button>
            <Button variant="brand" disabled>
              Salvando...
            </Button>
            <Button variant="outline" disabled>
              Desligado
            </Button>
          </Fileira>
        </div>
      </Secao>

      <Secao
        id="formulario"
        titulo="Formulário"
        descricao={
          <>
            Cada campo é um <code>Field</code> (
            <code>src/components/app/field.tsx</code>): rótulo, controle e uma
            linha de ajuda ou de erro. O erro diz o que fazer, não só que deu
            errado.
          </>
        }
      >
        <div className="grid max-w-xl gap-6">
          <Field
            id="estilo-nome"
            label="Nome"
            hint="Como você aparece para as outras pessoas."
          >
            <Input id="estilo-nome" defaultValue="Marina Duarte" />
          </Field>
          <Field
            id="estilo-email"
            label="E-mail"
            error="Digite um e-mail válido, como nome@exemplo.com.br."
          >
            <Input
              id="estilo-email"
              type="email"
              defaultValue="marina@"
              aria-invalid
            />
          </Field>
          <Field id="estilo-plano" label="Plano">
            <Select defaultValue="mensal">
              <SelectTrigger id="estilo-plano" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="estilo-obs" label="Observações">
            <Textarea id="estilo-obs" rows={3} />
          </Field>
          <div className="flex items-center gap-3">
            <Checkbox id="estilo-termos" defaultChecked />
            <Label htmlFor="estilo-termos">Li e aceito os termos de uso</Label>
          </div>
          <div className="flex items-center justify-between gap-6">
            <div className="grid gap-0.5">
              <Label htmlFor="estilo-avisos">Avisos por e-mail</Label>
              <p className="text-sm text-muted-foreground">
                Um resumo por semana, sem propaganda.
              </p>
            </div>
            <Switch id="estilo-avisos" defaultChecked />
          </div>
        </div>
      </Secao>

      <Secao
        id="estados"
        titulo="Estados e avisos"
        descricao={
          <>
            A cor de um estado vai numa bolinha (<code>StatusDot</code>) ou num
            preenchimento; o texto ao lado fica neutro. Toda espera tem um
            esqueleto e toda ação termina num aviso curto.
          </>
        }
      >
        <div className="grid gap-8">
          <Fileira rotulo="Estado de um item">
            <StatusDot tone="success">Ativo</StatusDot>
            <StatusDot tone="warning">Pendente</StatusDot>
            <StatusDot tone="danger">Falhou</StatusDot>
            <StatusDot>Inativo</StatusDot>
          </Fileira>
          <Fileira rotulo="Etiquetas">
            <Badge>Novo</Badge>
            <Badge variant="secondary">Rascunho</Badge>
            <Badge variant="outline">Opcional</Badge>
          </Fileira>
          <Fileira rotulo="Avisos (toast)">
            <Button
              variant="outline"
              onClick={() => toast.success('Alterações salvas')}
            >
              Aviso de sucesso
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.error('Não foi possível salvar. Tente de novo.')
              }
            >
              Aviso de erro
            </Button>
          </Fileira>
          <div className="grid gap-3">
            <p className="kicker">Carregando (esqueleto)</p>
            <div className="grid max-w-md gap-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
          <div className="grid gap-3">
            <p className="kicker">Lista vazia</p>
            <div className="max-w-xl">
              <EmptyState
                icon={InboxIcon}
                title="Nada por aqui ainda"
                description="Quando você criar o primeiro item, ele aparece nesta lista."
                action={
                  <Button variant="brand">
                    <PlusIcon />
                    Criar item
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      </Secao>

      <Secao
        id="lista"
        titulo="Tela de lista"
        descricao={
          <>
            O molde de qualquer lista: abas e busca à esquerda, a ação principal
            à direita, a tabela e o estado vazio. Funciona de verdade (com dados
            de exemplo): filtre, busque, crie um item. O código está em{' '}
            <code>src/components/app/exemplo-lista.tsx</code>.
          </>
        }
      >
        <ExemploLista />
      </Secao>

      <Secao
        id="pagina"
        titulo="Página da área logada"
        descricao={
          <>
            Toda página em <code>src/routes/_app/app/</code> começa com um{' '}
            <code>PageHeader</code>. Números vão num <code>StatStrip</code> e
            cada assunto num <code>PageSection</code>: título à esquerda,
            conteúdo à direita, uma linha em cima e nenhum cartão em volta.
          </>
        }
      >
        <div className="rounded-[var(--radius-card)] border p-6 sm:p-8">
          <PageHeader
            title="Assinatura"
            description="Seu plano, a próxima cobrança e as notas."
            actions={<Button variant="outline">Ver notas</Button>}
          />
          <StatStrip>
            <StatCard
              label="Plano"
              value="Mensal"
              to="/estilo"
              cta="Trocar de plano"
            />
            <StatCard
              label="Próxima cobrança"
              value="05/12"
              to="/estilo"
              cta="Ver detalhes"
            />
          </StatStrip>
          <div className="mt-8">
            <PageSection
              title="Forma de pagamento"
              description="O cartão usado nas cobranças."
            >
              <div className="grid gap-1">
                <p className="text-sm text-muted-foreground">Cartão</p>
                <p className="font-medium">Final 4242</p>
              </div>
            </PageSection>
            <PageSection
              title="Avisos"
              description="O que chega no seu e-mail."
            >
              <div className="flex items-center justify-between gap-6">
                <Label htmlFor="estilo-recibo">Recibo a cada cobrança</Label>
                <Switch id="estilo-recibo" defaultChecked />
              </div>
            </PageSection>
          </div>
        </div>
      </Secao>
    </div>
  )
}
