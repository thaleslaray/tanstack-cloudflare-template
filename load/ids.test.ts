import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  idDeBuild,
  importsRelativos,
  nomeInternoDaFuncao,
  temIdDeServerFn,
  urlsDeJs,
} from './ids.js'

const sha256 = (t: string) => createHash('sha256').update(t).digest('hex')

describe('load/ids.js', () => {
  it('o nome interno do handler', () => {
    expect(nomeInternoDaFuncao('createClienteFn')).toBe(
      'createClienteFn_createServerFn_handler',
    )
  })

  it('o id de build é o do compilador do TanStack Start (valor medido no build)', () => {
    // Visto em dist/server/assets/__tanstack-start-server-fn-resolver-*.js.
    expect(
      idDeBuild(sha256, 'src/lib/clientes-fns.ts', 'createClienteFn'),
    ).toBe('169fb94a88fd7966f1efa41442f3d91f6e3b71c2d11934875e17a9ff4cd694c3')
    expect(
      idDeBuild(sha256, 'src/lib/clientes-fns.ts', 'deleteClienteFn'),
    ).toBe('296ffd4fe47e1e170395b8416d4200eb6eeee1c8326cb70357d288b1abde62c3')
  })

  it('aceita a barra inicial do caminho (como em arquivoDev)', () => {
    expect(
      idDeBuild(sha256, '/src/lib/clientes-fns.ts', 'createClienteFn'),
    ).toBe(idDeBuild(sha256, 'src/lib/clientes-fns.ts', 'createClienteFn'))
  })

  it('acha os .js que o HTML cita e os imports de um chunk', () => {
    const html =
      '<link rel="modulepreload" href="/assets/a-1.js"/><script src="/assets/b-2.js"></script><link href="/assets/x.css">'
    expect(urlsDeJs(html)).toEqual(['/assets/a-1.js', '/assets/b-2.js'])
    expect(
      importsRelativos(
        'import{a as b}from"./index-Abc.js";const c=()=>import(`./tela-Z9.js`),d=import("./x$y.js")',
      ),
    ).toEqual(['index-Abc.js', 'tela-Z9.js', 'x$y.js'])
  })

  it('confere o id só quando ele é o argumento de .handler(...)', () => {
    const id = 'a'.repeat(64)
    expect(
      temIdDeServerFn(`x=o({method:\`POST\`}).handler(i(\`${id}\`))`, id),
    ).toBe(true)
    expect(temIdDeServerFn(`x=o().handler(i("${id}"))`, id)).toBe(true)
    expect(temIdDeServerFn(`const lixo="${id}"`, id)).toBe(false)
  })
})

// Contrato com o build de verdade: se existir `dist/` (depois de `npm run build`),
// cada id calculado tem de estar no mapa id -> função do servidor, com o nome certo.
// Sem dist/ o teste é pulado (o `npm run test` roda antes do build no CI).
const dist = path.resolve(import.meta.dirname, '../dist/server/assets')
const mapa = fs.existsSync(dist)
  ? fs.readdirSync(dist).find((f) => /server-fn-resolver.*\.js$/.test(f))
  : undefined

describe('contrato com o build', () => {
  it.skipIf(!mapa)(
    'os ids calculados existem no mapa do servidor com o nome da função',
    () => {
      const js = fs.readFileSync(path.join(dist, mapa as string), 'utf8')
      for (const funcao of [
        'createClienteFn',
        'deleteClienteFn',
        'listClientesFn',
      ]) {
        const id = idDeBuild(sha256, 'src/lib/clientes-fns.ts', funcao)
        const trecho = new RegExp(
          `"${id}"\\s*:\\s*\\{\\s*functionName:\\s*"${funcao}_createServerFn_handler"`,
        )
        expect(js, funcao).toMatch(trecho)
      }
    },
  )
})
