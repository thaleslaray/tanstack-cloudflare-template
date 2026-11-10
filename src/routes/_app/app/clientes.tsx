import { createFileRoute, useRouter } from '@tanstack/react-router'
import { PlusIcon, SearchIcon, Trash2Icon, UsersIcon } from 'lucide-react'
import { useState } from 'react'
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

function ClientesPage() {
  const clientes = Route.useLoaderData()
  const router = useRouter()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busca, setBusca] = useState('')

  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [situacao, setSituacao] = useState<Situacao>('ativo')
  const [erroNome, setErroNome] = useState<string>()
  const [erroEmail, setErroEmail] = useState<string>()
  const [salvando, setSalvando] = useState(false)

  const [apagando, setApagando] = useState<{ id: string; nome: string }>()
  const [confirmando, setConfirmando] = useState(false)

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

  function abrirDialogo(valor: boolean) {
    setAberto(valor)
    if (!valor) {
      setNome('')
      setEmail('')
      setSituacao('ativo')
      setErroNome(undefined)
      setErroEmail(undefined)
    }
  }

  // Erro de um campo aparece junto do campo; qualquer outro (limite, sessão
  // vencida, rede) vira aviso, porque não é culpa de campo nenhum.
  function mostrarErro(e: unknown) {
    if (e instanceof CampoInvalido && e.campo === 'nome') {
      setErroNome(e.message)
    } else if (e instanceof CampoInvalido && e.campo === 'email') {
      setErroEmail(e.message)
    } else {
      toast.error(mensagemDe(e))
    }
  }

  async function criar(event: React.FormEvent) {
    event.preventDefault()
    try {
      validarCliente({ nome, email, situacao })
    } catch (e) {
      mostrarErro(e)
      return
    }
    setSalvando(true)
    try {
      await createClienteFn({ data: { nome, email, situacao } })
      await router.invalidate()
      abrirDialogo(false)
      toast.success('Cliente adicionado')
    } catch (e) {
      mostrarErro(e)
    } finally {
      setSalvando(false)
    }
  }

  async function apagar() {
    if (!apagando) return
    setConfirmando(true)
    try {
      await deleteClienteFn({ data: { id: apagando.id } })
      await router.invalidate()
      setApagando(undefined)
      toast.success('Cliente apagado')
    } catch (e) {
      toast.error(mensagemDe(e))
    } finally {
      setConfirmando(false)
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
            <Button variant="brand" onClick={() => abrirDialogo(true)}>
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
              <Button variant="brand" onClick={() => abrirDialogo(true)}>
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
                    <TableCell className="px-4 font-medium">
                      {cliente.nome}
                      {/* No celular a coluna de e-mail some e ele vem aqui. */}
                      <span className="block font-normal text-muted-foreground md:hidden">
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
                          setApagando({ id: cliente.id, nome: cliente.nome })
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

      <Dialog open={aberto} onOpenChange={abrirDialogo}>
        <DialogContent>
          <form onSubmit={criar} noValidate className="grid gap-5">
            <DialogHeader>
              <DialogTitle>Novo cliente</DialogTitle>
              <DialogDescription>
                Ele entra na sua lista agora.
              </DialogDescription>
            </DialogHeader>
            <Field id="cliente-nome" label="Nome" error={erroNome}>
              <Input
                id="cliente-nome"
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value)
                  setErroNome(undefined)
                }}
                aria-invalid={erroNome ? true : undefined}
                maxLength={120}
                autoComplete="off"
                required
              />
            </Field>
            <Field id="cliente-email" label="E-mail" error={erroEmail}>
              <Input
                id="cliente-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setErroEmail(undefined)
                }}
                aria-invalid={erroEmail ? true : undefined}
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
                onClick={() => abrirDialogo(false)}
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
        open={apagando !== undefined}
        onOpenChange={(valor) => {
          if (!valor) setApagando(undefined)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar {apagando?.nome}?</DialogTitle>
            <DialogDescription>
              O cliente some da sua lista e não dá para desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApagando(undefined)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={apagar}
              disabled={confirmando}
            >
              {confirmando ? 'Apagando...' : 'Apagar cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
