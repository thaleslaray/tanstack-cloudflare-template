import { useEffect, useRef, useState } from 'react'
import { Section, SectionHead } from '../section'
import type { BlockOf, TerminalLine } from '../types'

// Ritmo da "digitação", em milissegundos.
const MS_PER_CHAR = 38
const PAUSE_AFTER_COMMAND = 280
const PAUSE_AFTER_OUTPUT = 120

type Timed = {
  kind: 'cmd' | 'out' | 'ok'
  text: string
  /** Quando a linha aparece. */
  delay: number
}

/**
 * Calcula quando cada linha entra. É conta pura sobre o texto, então dá o
 * mesmo resultado no servidor e no navegador (sem erro de hidratação).
 */
function schedule(lines: TerminalLine[]): Timed[] {
  let t = 300
  return lines.map((line) => {
    if (typeof line === 'string') {
      const item: Timed = { kind: 'cmd', text: line, delay: t }
      t += line.length * MS_PER_CHAR + PAUSE_AFTER_COMMAND
      return item
    }
    const item: Timed =
      'ok' in line
        ? { kind: 'ok', text: line.ok, delay: t }
        : { kind: 'out', text: line.out, delay: t }
    t += PAUSE_AFTER_OUTPUT
    return item
  })
}

/**
 * Liga a animação só quando vale a pena:
 *   - `static`: o HTML do servidor, tudo à mostra (é o que vê quem está sem
 *     JavaScript, quem pediu menos movimento e quem já chegou com o bloco na
 *     tela, para nada sumir e reaparecer na frente da pessoa);
 *   - `armed`: fora da tela, linhas escondidas e animação pausada;
 *   - `play`: entrou na tela, a animação corre.
 * A animação em si é CSS (`.terminal-anim` em src/styles.css).
 */
function useTyping(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<'static' | 'armed' | 'play'>('static')

  useEffect(() => {
    const el = ref.current
    if (!enabled || !el || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const box = el.getBoundingClientRect()
    if (box.top < window.innerHeight && box.bottom > 0) return
    setPhase('armed')
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPhase('play')
          observer.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [enabled])

  return { ref, phase }
}

/**
 * Uma janela de terminal. Fundo e as duas cores de texto vêm dos tokens
 * `--terminal*`, então cada tema tem o seu. A primeira fileira é só a pasta,
 * em cinza: sem as três bolinhas de janela, que não dizem nada.
 */
export function TerminalBlock({ block }: { block: BlockOf<'terminal'> }) {
  const lines = schedule(block.lines)
  const { ref, phase } = useTyping(block.animate !== false)
  const hasHead = block.kicker && block.title

  return (
    <Section>
      {hasHead ? (
        <SectionHead
          kicker={block.kicker ?? ''}
          title={block.title ?? ''}
          lead={block.lead}
        />
      ) : null}
      <div
        ref={ref}
        data-phase={phase}
        className={`terminal-anim overflow-hidden rounded-[var(--radius-card)] bg-terminal text-terminal-foreground shadow-[var(--shadow-card)] ${hasHead ? 'mt-12' : ''}`}
      >
        {block.label ? (
          <p className="border-b border-terminal-muted/25 px-5 py-3 font-mono text-xs text-terminal-muted">
            {block.label}
          </p>
        ) : null}
        <pre className="overflow-x-auto p-5 font-mono text-xs leading-6 sm:text-sm">
          {lines.map((line, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: linhas fixas, nunca reordenadas; o mesmo comando pode repetir
              key={i}
              className={`terminal-line ${
                line.kind === 'out'
                  ? 'text-terminal-muted'
                  : line.kind === 'ok'
                    ? 'text-success'
                    : ''
              }`}
              style={
                { '--line-delay': `${line.delay}ms` } as React.CSSProperties
              }
            >
              {line.kind === 'cmd' ? (
                <>
                  <span aria-hidden className="select-none text-terminal-muted">
                    ${' '}
                  </span>
                  <span
                    className="terminal-typed"
                    style={
                      {
                        '--chars': line.text.length,
                        '--type-ms': `${line.text.length * MS_PER_CHAR}ms`,
                      } as React.CSSProperties
                    }
                  >
                    {line.text}
                  </span>
                </>
              ) : (
                line.text
              )}
            </div>
          ))}
        </pre>
      </div>
    </Section>
  )
}
