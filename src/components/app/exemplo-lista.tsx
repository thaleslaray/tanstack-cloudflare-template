import { PlusIcon, SearchIcon, UsersIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { TableFrame, Toolbar } from '#/components/app/data-list'
import { EmptyState } from '#/components/app/empty-state'
import { Field } from '#/components/app/field'
import { StatusDot, type StatusTone } from '#/components/app/status'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '#/components/ui/tabs'

// A TELA DE LISTA de referência: filtro por abas, busca, tabela, estado
// vazio e um diálogo que cria um item. É o molde para qualquer "lista de
// alguma coisa" da área logada (clientes, pedidos, tarefas).
//
// Aqui os dados moram em `useState`, de mentira, para a bancada /estilo
// funcionar sem banco. Numa tela de verdade:
//   - a lista vem do `loader` da rota, que chama uma server function com
//     `getDb(env.DB)` (veja src/routes/demo/drizzle.tsx);
//   - criar chama uma server function `method: 'POST'` e depois
//     `router.invalidate()`;
//   - a mesma tela ligada ao banco é src/routes/_app/app/clientes.tsx;
//   - o passo a passo está na skill /tela (.claude/skills/tela/SKILL.md).
//
// Quatro decisões do molde que valem para toda lista:
//   1. Um botão da marca por tela. Com a lista vazia, a faixa de filtros some
//      (não há o que filtrar) e o botão da marca é o do estado vazio.
//   2. O diálogo de criar fica fora da faixa, controlado por `aberto`, para
//      os dois botões abrirem o mesmo.
//   3. Cada campo tem o SEU erro. Erro que não é de campo (limite, rede) vira
//      `toast.error`.
//   4. No celular, as colunas secundárias somem (`hidden md:table-cell`) e o
//      dado que importa desce para baixo do nome. A tabela não deve precisar
//      rolar de lado para alcançar uma ação.

type Situacao = 'ativo' | 'pendente' | 'inativo'

type Cliente = {
  id: number
  nome: string
  email: string
  situacao: Situacao
  desde: string
}

const SITUACOES: Record<Situacao, { rotulo: string; tom: StatusTone }> = {
  ativo: { rotulo: 'Ativo', tom: 'success' },
  pendente: { rotulo: 'Pendente', tom: 'warning' },
  inativo: { rotulo: 'Inativo', tom: 'neutral' },
}

const INICIAIS: Cliente[] = [
  {
    id: 1,
    nome: 'Marina Duarte',
    email: 'marina@exemplo.com.br',
    situacao: 'ativo',
    desde: '12/03/2026',
  },
  {
    id: 2,
    nome: 'Caio Figueiredo',
    email: 'caio@exemplo.com.br',
    situacao: 'pendente',
    desde: '02/06/2026',
  },
  {
    id: 3,
    nome: 'Lívia Sampaio',
    email: 'livia@exemplo.com.br',
    situacao: 'ativo',
    desde: '21/08/2026',
  },
  {
    id: 4,
    nome: 'Otávio Reis',
    email: 'otavio@exemplo.com.br',
    situacao: 'inativo',
    desde: '30/09/2026',
  },
]

type Filtro = 'todos' | Situacao

export function ExemploLista() {
  const [clientes, setClientes] = useState(INICIAIS)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [erroNome, setErroNome] = useState<string>()
  const [erroEmail, setErroEmail] = useState<string>()

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
      setErroNome(undefined)
      setErroEmail(undefined)
    }
  }

  function criar(event: React.FormEvent) {
    event.preventDefault()
    // Um erro por campo, cada um embaixo do seu.
    const faltaNome = !nome.trim()
    const emailRuim = !/^\S+@\S+\.\S+$/.test(email.trim())
    if (faltaNome) setErroNome('Escreva o nome do cliente.')
    if (emailRuim) {
      setErroEmail('Digite um e-mail válido, como nome@exemplo.com.br.')
    }
    if (faltaNome || emailRuim) return
    setClientes((atual) => [
      {
        id: Date.now(),
        nome: nome.trim(),
        email: email.trim(),
        situacao: 'pendente',
        desde: 'hoje',
      },
      ...atual,
    ])
    abrirDialogo(false)
    toast.success('Cliente adicionado')
  }

  return (
    <div>
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
                <TableHead className="hidden px-4 text-right md:table-cell">
                  Cliente desde
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.map((cliente) => (
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
                    <StatusDot tone={SITUACOES[cliente.situacao].tom}>
                      {SITUACOES[cliente.situacao].rotulo}
                    </StatusDot>
                  </TableCell>
                  <TableCell className="hidden px-4 text-right text-muted-foreground tabular-nums md:table-cell">
                    {cliente.desde}
                  </TableCell>
                </TableRow>
              ))}
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
                Ele entra na lista como pendente.
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
                autoComplete="off"
                required
              />
            </Field>
            <Field
              id="cliente-email"
              label="E-mail"
              hint="Usado só para identificar o cliente na lista."
              error={erroEmail}
            >
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => abrirDialogo(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="brand">
                Adicionar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
