// O "momento" do hero: o painel da área logada (`/app`) desenhado em código,
// com dados plausíveis. Não é imagem nem iframe: são os mesmos tokens do app
// real, então muda junto com o tema. Só decorativo (aria-hidden); o usuário
// vê o painel de verdade depois de entrar.
//
// Mantenha fiel ao que `src/routes/_app/app/index.tsx` mostra. Se o painel
// ganhar uma área nova, acrescente aqui também, ou o hero promete uma coisa e
// o app entrega outra.

const stats = [
  { label: 'Membro desde', value: '12/03/2026', cta: 'Ver configurações' },
  { label: 'Atividades registradas', value: '28', cta: 'Baixar meus dados' },
  { label: 'Guias na documentação', value: '3', cta: 'Ler a documentação' },
]

const steps = [
  { label: 'Escolha uma foto de perfil', done: true },
  { label: 'Confira seu nome', done: true },
  { label: 'Ligue o login com Google', done: false },
]

export function AppPreview({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`flex overflow-hidden rounded-[var(--radius-card)] border border-border bg-card text-foreground ${className}`}
    >
      {/* Barra lateral */}
      <aside className="hidden w-40 shrink-0 flex-col border-r border-border bg-surface p-3 sm:flex">
        <div className="flex items-center gap-2 px-2 py-1">
          <span className="relative flex size-4 items-center justify-center rounded-full border border-dashed border-foreground/40">
            <span className="size-2 rounded-full bg-brand" />
          </span>
          <span className="text-xs font-semibold">Meu App</span>
        </div>
        <nav className="mt-4 flex flex-col gap-1">
          <span className="rounded-md border-l-2 border-foreground bg-background px-2 py-1.5 text-xs font-medium">
            Painel
          </span>
          <span className="border-l-2 border-transparent px-2 py-1.5 text-xs text-muted-foreground">
            Configurações
          </span>
        </nav>
        <div className="mt-auto flex items-center gap-2 border-t border-border px-2 pt-3">
          <span className="flex size-5 items-center justify-center rounded-full bg-secondary text-[11px] font-medium">
            A
          </span>
          <span className="truncate text-[11px] text-muted-foreground">
            ana@clinica.com.br
          </span>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <p className="text-sm font-semibold">Olá, Ana</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Um resumo da sua conta.
        </p>

        <div className="mt-4 flex divide-x divide-border overflow-hidden rounded-lg border border-border">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0 flex-1 px-3 py-2.5">
              <p className="text-[11px] leading-tight text-muted-foreground">
                {s.label}
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums">
                {s.value}
              </p>
              <p className="mt-1.5 text-[11px] leading-tight text-muted-foreground">
                {s.cta} →
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-border">
          <div className="px-3 pt-3">
            <p className="text-xs font-semibold">Primeiros passos</p>
            <p className="text-[11px] text-muted-foreground">2 de 3 feitos</p>
            <div className="mt-2 h-1 max-w-[160px] overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-2/3 rounded-full bg-brand" />
            </div>
          </div>
          <ul className="mt-2 divide-y divide-border border-t border-border">
            {steps.map((s) => (
              <li
                key={s.label}
                className="flex items-center gap-2 px-3 py-2 text-[11px]"
              >
                <span
                  className={`size-3 rounded-full border ${
                    s.done
                      ? 'border-foreground bg-foreground'
                      : 'border-muted-foreground'
                  }`}
                />
                <span
                  className={
                    s.done
                      ? 'text-muted-foreground line-through'
                      : 'font-medium'
                  }
                >
                  {s.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
