import { createFileRoute, Link, type LinkProps } from '@tanstack/react-router'
import {
  ArrowRightIcon,
  CircleCheckIcon,
  CircleIcon,
  XIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { PageHeader, StatCard, StatStrip } from '#/components/page-header'
import { getDashboardStatsFn } from '#/lib/app-fns'
import { seo } from '#/lib/seo'

// Painel: saudação, um número por área (cada um leva à sua área) e um
// checklist de primeiro uso que some quando completo ou dispensado. Área nova?
// Dê a ela um StatCard e, se tiver um primeiro passo, uma linha no checklist.
export const Route = createFileRoute('/_app/app/')({
  loader: () => getDashboardStatsFn(),
  head: () => ({ meta: seo({ title: 'Painel', noindex: true }) }),
  component: DashboardPage,
})

type SetupStep = {
  done: boolean
  label: string
  hint: string
  to: LinkProps['to']
}

const SETUP_DISMISSED = 'app-checklist-dispensado'

// Só aparece depois de montar: se foi dispensado mora no localStorage deste
// navegador, e um render do servidor que o mostrasse piscaria para quem fechou.
function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const [dismissed, setDismissed] = useState<boolean | null>(null)
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(SETUP_DISMISSED) === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  const done = steps.filter((step) => step.done).length
  if (dismissed !== false || done === steps.length) return null

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(SETUP_DISMISSED, '1')
    } catch {
      // Navegador sem localStorage (aba anônima restrita): some só nesta visita.
    }
  }

  return (
    <section
      aria-label="Primeiros passos"
      className="mt-8 rounded-[var(--radius-card)] border"
    >
      <div className="flex items-start justify-between gap-4 px-5 pt-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Primeiros passos</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {done} de {steps.length} feitos
          </p>
          <div className="mt-3 h-1 max-w-xs overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-brand transition-[width]"
              style={{ width: `${(done / steps.length) * 100}%` }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar primeiros passos"
          title="Dispensar"
          className="-mr-1 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <XIcon className="size-4" />
        </button>
      </div>
      <ul className="mt-3 divide-y border-t">
        {steps.map((step) => (
          <li key={step.label}>
            <Link
              to={step.to}
              className="group flex items-center gap-3 px-5 py-3 text-foreground no-underline transition-colors hover:bg-surface"
            >
              {step.done ? (
                <CircleCheckIcon className="size-4 shrink-0 text-foreground" />
              ) : (
                <CircleIcon className="size-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${step.done ? 'text-muted-foreground line-through' : ''}`}
                >
                  {step.label}
                </p>
                {step.done ? null : (
                  <p className="text-sm text-muted-foreground">{step.hint}</p>
                )}
              </div>
              {step.done ? null : (
                <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function DashboardPage() {
  const { session } = Route.useRouteContext()
  const { activity, clients } = Route.useLoaderData()
  const user = session.user
  const firstName = user.name.split(' ')[0] || user.name
  // Fuso fixo: o servidor (UTC) e o navegador formatam a mesma data, sem
  // diferença de hidratação perto da meia-noite.
  const since = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(user.createdAt))
  // O nome padrão é a parte do e-mail antes do @ (src/lib/auth.ts).
  const hasCustomName = user.name !== user.email.split('@')[0]

  return (
    <div>
      <PageHeader
        title={`Olá, ${firstName}`}
        description="Um resumo da sua conta."
      />

      <StatStrip>
        <StatCard
          label="Clientes"
          value={clients}
          to="/app/clientes"
          cta="Ver clientes"
        />
        <StatCard
          label="Membro desde"
          value={since}
          to="/app/configuracoes"
          cta="Ver configurações"
        />
        <StatCard
          label="Atividades registradas"
          value={activity}
          to="/app/configuracoes"
          cta="Baixar meus dados"
        />
      </StatStrip>

      <SetupChecklist
        steps={[
          {
            done: Boolean(user.image),
            label: 'Escolha uma foto de perfil',
            hint: 'Ela aparece no cabeçalho e no menu da conta.',
            to: '/app/configuracoes',
          },
          {
            done: hasCustomName,
            label: 'Confira seu nome',
            hint: 'Usamos a parte do e-mail antes do @ até você trocar.',
            to: '/app/configuracoes',
          },
          {
            done: clients > 0,
            label: 'Adicione seu primeiro cliente',
            hint: 'Só você vê a sua lista de clientes.',
            to: '/app/clientes',
          },
        ]}
      />
    </div>
  )
}
