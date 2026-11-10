import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// As regras do CLAUDE.md marcadas com (teste), em forma de teste. Regra
// escrita é seguida quase sempre; estas transformam o "quase" em teste
// vermelho em vez de bug em produção. Mudou a regra? Mude nos dois lugares.
//
// São heurísticas por texto (sem parser de TypeScript): pegam o erro comum,
// não todo erro possível. Se uma delas acusar algo legítimo, prefira ajustar
// o código; se não der, acrescente uma exceção NOMEADA aqui, com o motivo.

const SRC = import.meta.dirname

function sourceFiles(dir = SRC): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      // Código só de teste não segue as regras do app.
      return entry.name === 'test' ? [] : sourceFiles(path)
    }
    if (entry.name === 'routeTree.gen.ts') return [] // gerado pelo router
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [path]
      : []
  })
}

// Troca comentários (e, se pedido, o conteúdo de strings) por espaços,
// mantendo as quebras de linha para o número da linha continuar certo.
function blank(code: string, { strings }: { strings: boolean }): string {
  let out = ''
  let i = 0
  const keepNewlines = (s: string) => s.replace(/[^\n]/g, ' ')
  while (i < code.length) {
    const two = code.slice(i, i + 2)
    if (two === '//') {
      const end = code.indexOf('\n', i)
      const stop = end === -1 ? code.length : end
      out += keepNewlines(code.slice(i, stop))
      i = stop
    } else if (two === '/*') {
      const end = code.indexOf('*/', i + 2)
      const stop = end === -1 ? code.length : end + 2
      out += keepNewlines(code.slice(i, stop))
      i = stop
    } else if (code[i] === "'" || code[i] === '"' || code[i] === '`') {
      const quote = code[i]
      let j = i + 1
      while (j < code.length && code[j] !== quote) {
        if (code[j] === '\\') j++
        else if (quote !== '`' && code[j] === '\n') break
        j++
      }
      const literal = code.slice(i, j + 1)
      out += strings
        ? quote + keepNewlines(literal.slice(1, -1)) + quote
        : literal
      i = j + 1
    } else {
      out += code[i]
      i++
    }
  }
  return out
}

const lineOf = (code: string, index: number) =>
  code.slice(0, index).split('\n').length

// Mantém só o que está no escopo do módulo (fora de qualquer chave,
// parêntese ou colchete); o resto vira espaço.
function moduleScopeOnly(code: string): string {
  let depth = 0
  let out = ''
  for (const ch of code) {
    if ('{(['.includes(ch)) {
      depth++
      out += ' '
    } else if ('})]'.includes(ch)) {
      depth = Math.max(0, depth - 1)
      out += ' '
    } else {
      out += depth === 0 || ch === '\n' ? ch : ' '
    }
  }
  return out
}

const files = sourceFiles().map((path) => {
  const raw = readFileSync(path, 'utf8')
  return {
    path: relative(SRC, path),
    raw,
    // sem comentários, strings intactas
    code: blank(raw, { strings: false }),
    // sem comentários e sem o conteúdo das strings
    bare: blank(raw, { strings: true }),
  }
})

// Cor fixa (hex, rgb, hsl) em código de componente. Só olha dentro de strings
// (className, style, atributos): texto de JSX como "Pedido #1234" não conta.
// Dentro da string, hex só vale em contexto de CSS: depois de `:`, espaço, `(`,
// `[` ou `,` (ex.: `bg-[#ff0000]`, `color: #fff`), ou como valor de atributo de
// cor (`fill="#fff"`). Âncoras (`href="#add"`), ids e rotas ficam de fora, e
// número puro (`#1234`) só conta com `:`, `[` ou `(` antes.
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g
const COLOR_ATTR =
  /\b(?:fill|stroke|color|stopColor|floodColor|background\w*)\s*[=:]\s*$/
const COLOR_FN = /\b(?:rgba?|hsla?)\(/g

function hardcodedColors(code: string): { index: number; text: string }[] {
  const out: { index: number; text: string }[] = []
  const literal = /(['"])((?:\\.|(?!\1)[^\\\n])*)\1|`((?:\\.|[^\\`])*)`/g
  for (const m of code.matchAll(literal)) {
    const body = m[2] ?? m[3] ?? ''
    const start = (m.index ?? 0) + 1
    // Âncora ou rota (`#secao`, `/docs#x`): não é cor.
    if (body.startsWith('#') && !/^#[0-9a-fA-F]{3,8}$/.test(body)) continue
    if (body.startsWith('/')) continue
    for (const h of body.matchAll(HEX)) {
      const at = h.index ?? 0
      const before = body[at - 1]
      const attrOnly =
        at === 0 && COLOR_ATTR.test(code.slice(0, start - 1).slice(-30))
      const cssContext = before !== undefined && ':[(, '.includes(before)
      if (!attrOnly && !cssContext) continue
      const onlyDigits = /^#\d+$/.test(h[0])
      if (
        onlyDigits &&
        !(before !== undefined && ':[('.includes(before)) &&
        !attrOnly
      ) {
        continue
      }
      out.push({ index: start + at, text: h[0] })
    }
    for (const f of body.matchAll(COLOR_FN)) {
      out.push({ index: start + (f.index ?? 0), text: f[0] })
    }
  }
  return out
}

const importsWorkers = (code: string) =>
  /from\s+['"]cloudflare:workers['"]/.test(code)

function matches(re: RegExp, pick: (f: (typeof files)[number]) => string) {
  return files.flatMap((f) => {
    const text = pick(f)
    return [...text.matchAll(re)].map(
      (m) => `${f.path}:${lineOf(text, m.index ?? 0)}  ${m[0].trim()}`,
    )
  })
}

describe('regras do projeto (CLAUDE.md)', () => {
  it('encontra os arquivos de src/', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('componentes .tsx não usam cor fixa (hex, rgb, hsl): só tokens', () => {
    // Logo oficial do Google: as cores da marca são exigidas pelo próprio
    // Google e não mudam com o tema. Única exceção, de propósito.
    const ALLOWED = ['components/auth/social-buttons.tsx']
    const offenders = files
      .filter((f) => f.path.endsWith('.tsx') && !ALLOWED.includes(f.path))
      .flatMap((f) =>
        hardcodedColors(f.code).map(
          (hit) => `${f.path}:${lineOf(f.code, hit.index)}  ${hit.text}`,
        ),
      )
    expect(
      offenders,
      'Cor fixa em componente. Use as classes de token do Tailwind ' +
        '(bg-background, text-muted-foreground, bg-brand...). Cor nova? ' +
        'Crie o token em src/styles.css, em todos os temas.',
    ).toEqual([])
  })

  it('o detector de cor fixa pega cor de verdade e ignora falsos positivos', () => {
    const hits = (code: string) => hardcodedColors(code).length
    // Pega:
    expect(hits('<div className="bg-[#ff0000]" />')).toBe(1)
    expect(hits("const s = 'color: #fff'")).toBe(1)
    expect(hits('<path fill="#4285F4" />')).toBe(1)
    expect(hits("style={{ background: '#00000080' }}")).toBe(1)
    expect(hits('const c = `rgb(0 0 0)`')).toBe(1)
    // Ignora: âncoras, ids, números, rotas e texto de JSX.
    expect(hits('<a href="#add">ir</a>')).toBe(0)
    expect(hits('<a href="#fade">ir</a>')).toBe(0)
    expect(hits('<div id="#abc" />')).toBe(0)
    expect(hits('<p>Pedido #1234</p>')).toBe(0)
    expect(hits("const msg = 'Pedido #1234'")).toBe(0)
    expect(hits("navigate({ to: '/docs#add' })")).toBe(0)
  })

  it('a cor da marca nunca é cor de texto: só preenchimento (bg-brand + text-brand-foreground)', () => {
    // Regra 1 de src/CLAUDE.md. `text-brand-foreground` e `text-brand-hover`
    // são permitidos; `text-brand` sozinho (marca como cor de letra) não.
    const offenders = matches(/\btext-brand(?!-foreground|-hover)\b/g, (f) =>
      f.path.endsWith('.tsx') ? f.code : '',
    )
    expect(
      offenders,
      'Cor da marca em texto. Texto é só foreground ou muted-foreground; ' +
        'a marca vai em preenchimento (bg-brand) com text-brand-foreground por cima. ' +
        'Veja src/CLAUDE.md, regra 1.',
    ).toEqual([])
  })

  it('nada sobe nem cresce no hover, e a transição é nomeada (sem transition-all)', () => {
    // Regra 7 de src/CLAUDE.md: hover muda cor ou superfície; movimento só
    // com propósito. `transition-all` anima layout e trava em máquina fraca.
    const offenders = matches(
      /\bhover:-?translate-y-|\bhover:scale-|\btransition-all\b|\banimate-bounce\b/g,
      (f) => (f.path.endsWith('.tsx') ? f.code : ''),
    )
    expect(
      offenders,
      'Movimento de template: elemento que sobe ou cresce no hover, ou ' +
        '`transition-all`. Use `transition-colors` (ou nomeie as propriedades) ' +
        'e troque cor/superfície no hover. Veja src/CLAUDE.md, regra 7.',
    ).toEqual([])
  })

  it('títulos até o peso 600: sem font-bold, font-extrabold ou font-black', () => {
    // Regra 6 de src/CLAUDE.md: hierarquia vem de tamanho e cor, não de peso.
    const offenders = matches(/\bfont-(?:bold|extrabold|black)\b/g, (f) =>
      f.path.endsWith('.tsx') ? f.code : '',
    )
    expect(
      offenders,
      'Peso acima de 600 em componente. Use font-medium ou font-semibold e ' +
        'dê hierarquia pelo tamanho. Veja src/CLAUDE.md, regra 6.',
    ).toEqual([])
  })

  it('botão da marca usa a variante: <Button variant="brand">, não classes à mão', () => {
    // O hover da marca (`hover:bg-brand-hover`) escrito num componente é o
    // sinal de um botão de marca montado à mão. Os três arquivos abaixo são
    // os donos da receita: a variante em si e os dois estilos de link (<a>)
    // da landing e das páginas de erro, que não são <Button>.
    const ALLOWED = [
      'components/ui/button.tsx',
      'components/landing/section.tsx',
      'components/error-pages.tsx',
    ]
    const offenders = matches(/\bhover:bg-brand-hover\b/g, (f) =>
      f.path.endsWith('.tsx') && !ALLOWED.includes(f.path) ? f.code : '',
    )
    expect(
      offenders,
      'Botão da marca montado à mão. Use <Button variant="brand"> ' +
        '(src/components/ui/button.tsx): um por tela, na ação principal. ' +
        'Veja src/CLAUDE.md, regra 3.',
    ).toEqual([])
  })

  it('env de cloudflare:workers só é lido dentro de função', () => {
    const offenders = matches(/(?<![\w.$])env\s*\.\s*\w+|=\s*env\b/g, (f) =>
      importsWorkers(f.code) ? moduleScopeOnly(f.bare) : '',
    )
    expect(
      offenders,
      'env lido no escopo do módulo. Leia env dentro da função que usa o ' +
        'valor (handler, server function, factory como getDb(env.DB)): no ' +
        'escopo do módulo ele é avaliado uma vez só e pode vir vazio.',
    ).toEqual([])
  })

  it('cloudflare:workers não entra em arquivo que vai para o navegador', () => {
    // Rotas e componentes vão para o bundle do client. Só podem importar
    // cloudflare:workers se o uso estiver em createServerFn ou num handler
    // `server:` de rota de API, que o build separa do client.
    const offenders = files
      .filter(
        (f) =>
          importsWorkers(f.code) &&
          (f.path.endsWith('.tsx') ||
            /^(routes|components|integrations)\//.test(f.path)) &&
          !/createServerFn\s*\(|\bserver\s*:/.test(f.code),
      )
      .map((f) => f.path)
    expect(
      offenders,
      'Este arquivo vai para o navegador e importa cloudflare:workers. ' +
        'Mova o acesso aos bindings para uma createServerFn (ou para ' +
        'src/lib/*, chamado só por código de servidor).',
    ).toEqual([])
  })

  it('o código não importa o Wrangler nem cita cloudflare.config', () => {
    const offenders = [
      ...matches(
        /(?:from\s+|require\s*\(\s*|import\s*\(\s*)['"]wrangler(?:\/[^'"]*)?['"]/g,
        (f) => f.code,
      ),
      ...matches(/cloudflare\.config/g, (f) => f.raw),
    ]
    expect(
      offenders,
      'O Wrangler é ferramenta de linha de comando (deploy, tipos, D1); ' +
        'não roda dentro do Worker. A config é o wrangler.jsonc e chega ao ' +
        'código como bindings em env. cloudflare.config.ts é do cf/v2 beta, ' +
        'que este projeto não usa (veja CLAUDE.md).',
    ).toEqual([])
  })

  it('src/ não usa process.env', () => {
    const offenders = matches(/\bprocess\s*\.\s*env\b/g, (f) => f.code)
    expect(
      offenders,
      'process.env não é o caminho no Worker (pode vir vazio). Segredos e ' +
        'variáveis chegam por ' +
        "import { env } from 'cloudflare:workers' (lido dentro de função); " +
        'chave nova vai no .dev.vars.example e em npm run cf-typegen.',
    ).toEqual([])
  })

  // Ideia para depois: exigir `import '@tanstack/react-start/server-only'`
  // como primeiro import nos módulos que leem `env` de cloudflare:workers
  // (rate-limit, email, audit-d1, account-handlers, auth, jobs). O subpath
  // existe e faz o build falhar se o arquivo for parar no navegador. Ficou de
  // fora porque rate-limit.ts é importado pelas rotas de demo e auth.ts pelas
  // server functions: antes de ligar, confirme no build que nada disso vai ao
  // bundle do client. jobs.ts e account-handlers.ts já têm a linha.

  it('só src/lib/email.ts fala com a API do Resend', () => {
    const offenders = matches(/api\.resend\.com/g, (f) =>
      f.path === 'lib/email.ts' ? '' : f.code,
    )
    expect(
      offenders,
      'Todo e-mail passa por sendEmail() em src/lib/email.ts, que escolhe ' +
        'o provedor (Resend, Email Service ou terminal). Chame sendEmail().',
    ).toEqual([])
  })
})
