import { AppPreview } from '../app-preview'
import { primaryBtn, Section, SectionHead, secondaryBtn } from '../section'
import type { BlockOf as Of } from '../types'

// Os sete blocos com que a landing nasceu. Os formatos extras (bento,
// compare, stats, logos, terminal, gallery) moram um por arquivo nesta pasta.

/**
 * Hero em duas formas. Com `visual: 'app'`, texto à esquerda e o painel do
 * app (desenhado em código) à direita, subindo da borda de baixo: é a
 * primeira tela da landing real. Sem `visual`, a forma curta e centralizada,
 * para páginas sem o que mostrar. Uma única entrada animada (rise-in), em
 * escada curta; nada mais se move nesta tela.
 */
export function HeroBlock({ block }: { block: Of<'hero'> }) {
  const split = block.visual === 'app'
  const text = (
    <div
      className={`flex flex-col gap-6 ${split ? 'items-start text-left' : 'items-center text-center'}`}
    >
      {block.kicker ? <p className="kicker rise-in">{block.kicker}</p> : null}
      <h1
        className={`font-display rise-in leading-[1.02] tracking-[var(--tracking-display)] ${
          split
            ? 'max-w-xl text-5xl sm:text-6xl'
            : 'max-w-4xl text-5xl sm:text-7xl'
        }`}
        style={{ animationDelay: '50ms' }}
      >
        {block.title}
      </h1>
      <p
        className={`rise-in max-w-xl text-lg leading-relaxed text-muted-foreground ${split ? '' : 'sm:text-xl'}`}
        style={{ animationDelay: '100ms' }}
      >
        {block.subtitle}
      </p>
      <div
        className={`rise-in flex flex-wrap items-center gap-3 ${split ? '' : 'justify-center'}`}
        style={{ animationDelay: '150ms' }}
      >
        <a href={block.primary.to} className={primaryBtn}>
          {block.primary.label}
        </a>
        {block.secondary ? (
          <a href={block.secondary.to} className={secondaryBtn}>
            {block.secondary.label}
          </a>
        ) : null}
      </div>
      {block.note ? (
        <p
          className="rise-in text-sm text-muted-foreground"
          style={{ animationDelay: '200ms' }}
        >
          {block.note}
        </p>
      ) : null}
    </div>
  )

  if (!split) {
    return (
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-5 pb-16 pt-20 sm:px-8 sm:pb-24 sm:pt-28">
        {text}
      </section>
    )
  }

  return (
    <section className="w-full overflow-hidden border-b border-border">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 pt-16 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-16 lg:pt-20">
        <div className="pb-4 lg:pb-16">{text}</div>
        <div
          className="rise-in translate-y-6 self-end lg:translate-y-10"
          style={{ animationDelay: '200ms' }}
        >
          <AppPreview className="min-h-[360px] lg:min-h-[420px]" />
        </div>
      </div>
    </section>
  )
}

export function StackBlock({ block }: { block: Of<'stack'> }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pb-8 sm:px-8">
      {block.label ? (
        <p className="mb-5 text-center text-sm text-muted-foreground">
          {block.label}
        </p>
      ) : null}
      <ul className="flex flex-wrap justify-center gap-2">
        {block.items.map((name) => (
          <li
            key={name}
            className="rounded-[var(--radius-btn)] border border-border bg-surface px-4 py-1.5 text-sm font-medium text-foreground"
          >
            {name}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function FeaturesBlock({ block }: { block: Of<'features'> }) {
  return (
    <Section id="recursos">
      <SectionHead kicker={block.kicker} title={block.title} />
      <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {block.items.map((item, i) => (
          <li
            key={item.title}
            className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-6 shadow-[var(--shadow-card)]"
          >
            <span className="font-mono text-xs text-muted-foreground">
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 className="text-lg font-semibold tracking-tight">
              {item.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {item.body}
            </p>
            {item.path ? (
              <code className="mt-auto w-fit rounded-md bg-secondary px-2 py-1 font-mono text-xs text-muted-foreground">
                {item.path}
              </code>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  )
}

export function StepsBlock({ block }: { block: Of<'steps'> }) {
  return (
    <Section tone="sheet" id="como-usar">
      <SectionHead kicker={block.kicker} title={block.title} />
      <ol className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {block.steps.map((step, i) => (
          <li key={step.title} className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-sm font-medium text-foreground tabular-nums">
                {i + 1}
              </span>
              <h3 className="text-lg font-semibold">{step.title}</h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {step.body}
            </p>
            <pre className="mt-auto overflow-x-auto rounded-[var(--radius-card)] bg-terminal p-4 font-mono text-xs leading-relaxed text-terminal-foreground">
              {step.lines.map((line) => (
                <div key={line}>
                  <span className="select-none text-terminal-muted">$ </span>
                  {line}
                </div>
              ))}
            </pre>
          </li>
        ))}
      </ol>
    </Section>
  )
}

export function TestimonialsBlock({ block }: { block: Of<'testimonials'> }) {
  return (
    <Section id="depoimentos">
      <SectionHead kicker={block.kicker} title={block.title} />
      <ul className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
        {block.items.map((item, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: lista estática de conteúdo, sem reordenação; nomes podem repetir
            key={`${item.name}-${i}`}
            className="flex flex-col justify-between gap-6 rounded-[var(--radius-card)] border border-border bg-card p-6 shadow-[var(--shadow-card)]"
          >
            <p className="text-base leading-relaxed">“{item.quote}”</p>
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-sm font-semibold">
                {item.initials}
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold">{item.name}</span>
                <span className="text-xs text-muted-foreground">
                  {item.role}
                </span>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  )
}

export function FaqBlock({ block }: { block: Of<'faq'> }) {
  return (
    <Section tone="sheet" id="duvidas">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <SectionHead kicker={block.kicker} title={block.title} />
        </div>
        <div className="flex flex-col gap-3 lg:col-span-7 lg:col-start-6">
          {block.items.map((item) => (
            <details
              key={item.q}
              className="group rounded-[var(--radius-card)] border border-border bg-card px-5 py-4"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-base font-semibold [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  aria-hidden
                  className="shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  )
}

export function CtaBlock({ block }: { block: Of<'cta'> }) {
  return (
    <Section>
      <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="font-display max-w-2xl text-4xl leading-[1.02] tracking-[var(--tracking-display)] sm:text-6xl">
          {block.title}
        </h2>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <a href={block.primary.to} className={primaryBtn}>
            {block.primary.label}
          </a>
          {block.secondary ? (
            <a
              href={block.secondary.to}
              className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {block.secondary.label}
            </a>
          ) : null}
        </div>
      </div>
    </Section>
  )
}
