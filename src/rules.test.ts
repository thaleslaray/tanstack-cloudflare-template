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
    const offenders = matches(
      /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?)\(/g,
      (f) =>
        f.path.endsWith('.tsx') && !ALLOWED.includes(f.path) ? f.code : '',
    )
    expect(
      offenders,
      'Cor fixa em componente. Use as classes de token do Tailwind ' +
        '(bg-background, text-muted-foreground, bg-brand...). Cor nova? ' +
        'Crie o token em src/styles.css, em todos os temas.',
    ).toEqual([])
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
