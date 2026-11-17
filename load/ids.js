// Achar o id das server functions no build de produção. Arquivo puro (roda no
// k6 e nos testes, load/ids.test.ts), sem nada de Node nem do k6: o `sha256`
// entra como parâmetro.
//
// O id de uma server function no build é `sha256("<arquivo>--<função>_createServerFn_handler")`,
// com o arquivo relativo à raiz do projeto (ex.: `src/lib/clientes-fns.ts`).
// É assim que o compilador do TanStack Start calcula (start-plugin-core,
// `generateFunctionId`), e é o que aparece no mapa id -> função de
// `dist/server/assets/__tanstack-start-server-fn-resolver-*.js`. Esse mapa
// fica no servidor, não chega ao navegador; no JS que o navegador recebe o id
// só aparece como `.handler(<fn>("<hash de 64 letras>"))` e o nome da função é
// minificado. Por isso o roteiro CALCULA o id e depois CONFERE que ele existe
// nos JS servidos (se o TanStack mudar a conta, a conferência falha e entra o
// plano B, que acha a chamada no JS da tela).

/** O nome que o compilador dá ao handler: `createClienteFn` vira `createClienteFn_createServerFn_handler`. */
export function nomeInternoDaFuncao(funcao) {
  return `${funcao}_createServerFn_handler`
}

/** O id no build: sha256 de `<arquivo>--<função interna>`. `arquivo` aceita a barra inicial (`/src/...`). */
export function idDeBuild(sha256, arquivo, funcao) {
  const relativo = arquivo.replace(/^\/+/, '')
  return sha256(`${relativo}--${nomeInternoDaFuncao(funcao)}`)
}

/** Os `.js` que um HTML cita (`<script src>` e `<link href>`), como aparecem lá. */
export function urlsDeJs(html) {
  const urls = []
  const re = /(?:src|href)="([^"]+\.js)"/g
  for (let m = re.exec(html); m; m = re.exec(html)) urls.push(m[1])
  return urls
}

/**
 * Os arquivos `./nome.js` que um chunk importa (`from"./x.js"` e `import("./x.js")`),
 * para seguir a cadeia de imports. Só nomes da mesma pasta (/assets/).
 */
export function importsRelativos(js) {
  const nomes = []
  const re = /["'`]\.\/([\w.$-]+\.js)["'`]/g
  for (let m = re.exec(js); m; m = re.exec(js)) nomes.push(m[1])
  return nomes
}

/** O id aparece como argumento de `.handler(...)` no JS? (é como o cliente o referencia) */
export function temIdDeServerFn(js, id) {
  return new RegExp(`\\.handler\\([\\w$]+\\([\`'"]${id}[\`'"]\\)\\)`).test(js)
}
