import { createFileRoute, useRouter } from '@tanstack/react-router'
import { PlusIcon, SearchIcon, Trash2Icon, UsersIcon } from 'lucide-react'
import { useReducer, useState } from 'react'
import { toast } from 'sonner'

import { TableFrame, Toolbar } from '#/components/app/data-list'
import { EmptyState } from '#/components/app/empty-state'
import { Field } from '#/components/app/field'
import { StatusDot, type StatusTone } from '#/components/app/status'
import { PageHeader } from '#/components/page-header'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { CampoInvalido, type Situacao, validarCliente } from '#/lib/clientes'
import {
  createClienteFn,
  deleteClienteFn,
  listClientesFn,
} from '#/lib/clientes-fns'
import { seo } from '#/lib/seo'

// Clientes da pessoa logada, no D1. Molde: src/components/app/exemplo-lista.tsx.
export const Route = createFileRoute('/_app/app/clientes')({
  loader: () => listClientesFn(),
  head: () => ({ meta: seo({ title: 'Clientes', noindex: true }) }),
  component: ClientesPage,
})

const SITUACOES: Record<Situacao, { rotulo: string; tom: StatusTone }> = {
  ativo: { rotulo: 'Ativo', tom: 'success' },
  pendente: { rotulo: 'Pendente', tom: 'warning' },
  inativo: { rotulo: 'Inativo', tom: 'neutral' },
}

type Filtro = 'todos' | Situacao

// Fuso fixo: servidor (UTC) e navegador formatam a mesma data.
const formatarData = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

function mensagemDe(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'Algo deu errado. Tente de novo.'
}

// Os diálogos da tela, como máquina de estados: só UM está aberto por vez e o
// "o que está acontecendo" mora dentro dele, nunca em booleanos soltos.
//
//   nenhum --Novo cliente--> criar --Adicionar--> (salvando) --ok--> nenhum
//   nenhum --lixeira-------> apagar --Apagar----> (apagando) --ok--> nenhum
//
// Enquanto `salvando`/`apagando` o diálogo NÃO fecha (Esc, clique fora e
// Cancelar não fazem nada): senão o aviso de sucesso ou o erro chegaria depois
// de a tela já ter fechado. Falhou? O diálogo continua aberto, com o erro.
type Alvo = { id: string; nome: string }
type ErrosCriar = { nome?: string; email?: string }
type Dialogo =
  | { k: 'nenhum' }
  | { k: 'criar'; salvando: boolean; erros: ErrosCriar }
  | { k: 'apagar'; alvo: Alvo; apagando: boolean }

type Estado = {
  dialogo: Dialogo
  // Último cliente a apagar: o título "Apagar <nome>?" continua inteiro durante
  // a animação de saída, quando `dialogo` já voltou para 'nenhum'.
  ultimoAlvo?: Alvo
}

type Acao =
  | { t: 'abrir_criar' }
  | { t: 'abrir_apagar'; alvo: Alvo }
  | { t: 'fechar' }
  | { t: 'concluir' }
  | { t: 'comecou' }
  | { t: 'falhou'; erros?: ErrosCriar }
  | { t: 'limpar_erro'; campo: keyof ErrosCriar }

function reducer(estado: Estado, acao: Acao): Estado {
  const { dialogo } = estado
  switch (acao.t) {
    case 'abrir_criar':
      // Sempre começa limpo, sem erro de uma vez anterior.
      return { ...estado, dialogo: { k: 'criar', salvando: false, erros: {} } }
    case 'abrir_apagar':
      return {
        dialogo: { k: 'apagar', alvo: acao.alvo, apagando: false },
        ultimoAlvo: acao.alvo,
      }
    case 'fechar': {
      // Esc, clique fora e Cancelar: ignorados enquanto algo está sendo salvo.
      const ocupado =
        (dialogo.k === 'criar' && dialogo.salvando) ||
        (dialogo.k === 'apagar' && dialogo.apagando)
      return ocupado ? estado : { ...estado, dialogo: { k: 'nenhum' } }
    }
    case 'concluir':
      return { ...estado, dialogo: { k: 'nenhum' } }
    case 'comecou':
      if (dialogo.k === 'criar') {
        return { ...estado, dialogo: { ...dialogo, salvando: true } }
      }
      if (dialogo.k === 'apagar') {
        return { ...estado, dialogo: { ...dialogo, apagando: true } }
      }
      return estado
    case 'falhou':
      if (dialogo.k === 'criar') {
        return {
          ...estado,
          dialogo: {
            ...dialogo,
            salvando: false,
            erros: acao.erros ?? dialogo.erros,
          },
        }
      }
      if (dialogo.k === 'apagar') {
        return { ...estado, dialogo: { ...dialogo, apagando: false } }
      }
      return estado
    case 'limpar_erro':
      if (dialogo.k !== 'criar') return estado
      return {
        ...estado,
        dialogo: {
          ...dialogo,
          erros: { ...dialogo.erros, [acao.campo]: undefined },
        },
      }
  }
}

function ClientesPage() {
  const clientes = Route.useLoaderData()
  const router = useRouter()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busca, setBusca] = useState('')

  const [{ dialogo, ultimoAlvo }, dispatch] = useReducer(reducer, {
    dialogo: { k: 'nenhum' },
  })
  // Os valores dos campos ficam à parte: não são "estado do diálogo", só texto.
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [situacao, setSituacao] = useState<Situacao>('ativo')

  const criando = dialogo.k === 'criar'
  const salvando = dialogo.k === 'criar' && dialogo.salvando
  const erros = dialogo.k === 'criar' ? dialogo.erros : {}
  const apagando = dialogo.k === 'apagar' && dialogo.apagando

  // Sem nenhum cliente não há o que filtrar: a faixa de filtros some e o
  // estado vazio fica com o único botão da marca da tela.
  const semClientes = clientes.length === 0
  const termo = busca.trim().toLowerCase()
  const visiveis = clientes.filter(
    (c) =>
      (filtro === 'todos' || c.situacao === filtro) &&
      (!termo ||
        c.nome.toLowerCase().includes(termo) ||
        c.email.toLowerCase().includes(termo)),
  )

  function abrirCriar() {
    setNome('')
    setEmail('')
    setSituacao('ativo')
    dispatch({ t: 'abrir_criar' })
  }

  // Erro de um campo aparece junto do campo; qualquer outro (limite, sessão
  // vencida, rede) vira aviso, porque não é culpa de campo nenhum.
  function falhaAoCriar(e: unknown) {
    if (
      e instanceof CampoInvalido &&
      (e.campo === 'nome' || e.campo === 'email')
    ) {
      dispatch({ t: 'falhou', erros: { [e.campo]: e.message } })
    } else {
      dispatch({ t: 'falhou' })
      toast.error(mensagemDe(e))
    }
  }

  async function criar(event: React.FormEvent) {
    event.preventDefault()
    if (salvando) return
    try {
      validarCliente({ nome, email, situacao })
    } catch (e) {
      falhaAoCriar(e)
      return
    }
    dispatch({ t: 'comecou' })
    try {
      await createClienteFn({ data: { nome, email, situacao } })
      await router.invalidate()
      dispatch({ t: 'concluir' })
      toast.success('Cliente adicionado')
    } catch (e) {
      falhaAoCriar(e)
    }
  }

  async function apagar() {
    if (dialogo.k !== 'apagar' || dialogo.apagando) return
    const { id } = dialogo.alvo
    dispatch({ t: 'comecou' })
    try {
      await deleteClienteFn({ data: { id } })
      await router.invalidate()
      dispatch({ t: 'concluir' })
      toast.success('Cliente apagado')
    } catch (e) {
      dispatch({ t: 'falhou' })
      toast.error(mensagemDe(e))
    }
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="As pessoas e empresas que você atende. Só você vê esta lista."
      />

      {semClientes ? null : (
        <Toolbar
          actions={
            <Button variant="brand" onClick={abrirCriar}>
              <PlusIcon />
              Novo cliente
            </Button>
          }
        >
          <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
            <TabsList>
              <TabsTrigger value="todos">Todos</TabsTrigger>
              <TabsTrigger value="ativo">Ativos</TabsTrigger>
              <TabsTrigger value="pendente">Pendentes</TabsTrigger>
              <TabsTrigger value="inativo">Inativos</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-64">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou e-mail"
              aria-label="Buscar clientes"
              className="pl-9"
            />
          </div>
        </Toolbar>
      )}

      {visiveis.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="Nenhum cliente por aqui"
          description={
            semClientes
              ? 'Quando você adicionar o primeiro cliente, ele aparece nesta lista.'
              : 'Nenhum cliente combina com o filtro ou a busca.'
          }
          action={
            semClientes ? (
              <Button variant="brand" onClick={abrirCriar}>
                <PlusIcon />
                Novo cliente
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setFiltro('todos')
                  setBusca('')
                }}
              >
                Limpar filtros
              </Button>
            )
          }
        />
      ) : (
        <TableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Nome</TableHead>
                <TableHead className="hidden px-4 md:table-cell">
                  E-mail
                </TableHead>
                <TableHead className="px-4">Situação</TableHead>
                <TableHead className="hidden px-4 md:table-cell">
                  Cliente desde
                </TableHead>
                <TableHead className="px-4">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.map((cliente) => {
                const info =
                  SITUACOES[cliente.situacao as Situacao] ?? SITUACOES.inativo
                return (
                  <TableRow key={cliente.id}>
                    <TableCell className="w-full max-w-0 truncate px-4 font-medium md:w-auto md:max-w-none">
                      {cliente.nome}
                      {/* No celular a coluna de e-mail some e ele vem aqui. A célula
                        fica com a largura que sobra (`w-full max-w-0`) e corta o
                        texto longo com reticências: a tabela não rola de lado. */}
                      <span className="block truncate font-normal text-muted-foreground md:hidden">
                        {cliente.email}
                      </span>
                    </TableCell>
                    <TableCell className="hidden px-4 text-muted-foreground md:table-cell">
                      {cliente.email}
                    </TableCell>
                    <TableCell className="px-4">
                      <StatusDot tone={info.tom}>{info.rotulo}</StatusDot>
                    </TableCell>
                    <TableCell className="hidden px-4 text-muted-foreground tabular-nums md:table-cell">
                      {formatarData.format(new Date(cliente.createdAt))}
                    </TableCell>
                    <TableCell className="px-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Apagar ${cliente.nome}`}
                        onClick={() =>
                          dispatch({
                            t: 'abrir_apagar',
                            alvo: { id: cliente.id, nome: cliente.nome },
                          })
                        }
                      >
                        <Trash2Icon />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableFrame>
      )}

      <Dialog
        open={criando}
        onOpenChange={(valor) => {
          if (!valor) dispatch({ t: 'fechar' })
        }}
      >
        <DialogContent>
          <form onSubmit={criar} noValidate className="grid gap-5">
            <DialogHeader>
              <DialogTitle>Novo cliente</DialogTitle>
              <DialogDescription>
                Ele entra na sua lista agora.
              </DialogDescription>
            </DialogHeader>
            <Field id="cliente-nome" label="Nome" error={erros.nome}>
              <Input
                id="cliente-nome"
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value)
                  dispatch({ t: 'limpar_erro', campo: 'nome' })
                }}
                aria-invalid={erros.nome ? true : undefined}
                maxLength={120}
                autoComplete="off"
                required
              />
            </Field>
            <Field id="cliente-email" label="E-mail" error={erros.email}>
              <Input
                id="cliente-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  dispatch({ t: 'limpar_erro', campo: 'email' })
                }}
                aria-invalid={erros.email ? true : undefined}
                autoComplete="off"
                required
              />
            </Field>
            <Field id="cliente-situacao" label="Situação">
              <Select
                value={situacao}
                onValueChange={(v) => setSituacao(v as Situacao)}
              >
                <SelectTrigger id="cliente-situacao" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SITUACOES) as Situacao[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SITUACOES[s].rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={salvando}
                onClick={() => dispatch({ t: 'fechar' })}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="brand" disabled={salvando}>
                {salvando ? 'Adicionando...' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogo.k === 'apagar'}
        onOpenChange={(valor) => {
          if (!valor) dispatch({ t: 'fechar' })
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar {ultimoAlvo?.nome}?</DialogTitle>
            <DialogDescription>
              O cliente some da sua lista e não dá para desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={apagando}
              onClick={() => dispatch({ t: 'fechar' })}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={apagar} disabled={apagando}>
              {apagando ? 'Apagando...' : 'Apagar cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
