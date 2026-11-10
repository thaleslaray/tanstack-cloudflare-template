import fs from 'node:fs'
import { expect, type Page, test } from '@playwright/test'
import { loginWithCode, waitForHydration } from './helpers'

// O produto logado de ponta a ponta, com UM login só: entrar, navegar pela
// área logada, cadastrar um cliente, trocar a foto, baixar os dados, apagar o
// cliente e encerrar a conta. Um login por
// teste estouraria o rate limit (5 por minuto por IP nos endpoints de login).
test.describe.configure({ mode: 'serial' })

// PNG 1x1 válido (os primeiros bytes são conferidos pelo servidor).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)

let page: Page
const email = `e2e-${Date.now()}@exemplo.test`

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage()
})

test.afterAll(async () => {
  await page.close()
})

test('entra com o código enviado por e-mail e chega em /app', async () => {
  await page.goto('/login')
  await loginWithCode(page, email)

  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByRole('heading', { name: /^Olá,/ })).toBeVisible()
  await expect(page.getByText(email).first()).toBeVisible()
  await expect(page.getByText('Primeiros passos')).toBeVisible()
})

test('clientes: lista vazia, cria um cliente e ele aparece na tabela', async () => {
  await page
    .getByRole('navigation', { name: 'Área logada' })
    .getByRole('link', { name: 'Clientes' })
    .click()
  await expect(page).toHaveURL(/\/app\/clientes$/)
  await expect(page.getByText('Nenhum cliente por aqui')).toBeVisible()

  // Com a lista vazia só existe um botão de criar: o do estado vazio.
  const novo = page.getByRole('button', { name: 'Novo cliente' })
  await expect(novo).toHaveCount(1)
  await novo.click()
  const dialog = page.getByRole('dialog')

  // Erro de cada campo aparece junto do campo.
  await dialog.getByRole('button', { name: 'Adicionar' }).click()
  await expect(dialog.getByText('Escreva o nome do cliente.')).toBeVisible()

  await dialog.getByLabel('Nome').fill('Cliente E2E')
  await dialog.getByLabel('E-mail').fill('cliente-e2e@exemplo.test')
  await dialog.getByRole('button', { name: 'Adicionar' }).click()

  await expect(page.getByText('Cliente adicionado')).toBeVisible()
  await expect(page.getByRole('row', { name: /Cliente E2E/ })).toBeVisible()
})

test('a barra lateral leva às configurações', async () => {
  await page
    .getByRole('navigation', { name: 'Área logada' })
    .getByRole('link', { name: 'Configurações' })
    .click()
  await expect(page).toHaveURL(/\/app\/configuracoes$/)
  await expect(
    page.getByRole('heading', { name: 'Configurações', level: 1 }),
  ).toBeVisible()
})

test('troca a foto de perfil (R2)', async () => {
  const input = page.getByLabel('Foto de perfil')
  await waitForHydration(page.getByLabel('Nome'))
  await input.setInputFiles({
    name: 'foto.png',
    mimeType: 'image/png',
    buffer: PNG,
  })
  await page.getByRole('button', { name: 'Salvar foto' }).click()
  await expect(page.getByText('Foto atualizada')).toBeVisible()

  // A URL nova aponta para /api/avatar/<id>?v=..., e a imagem carrega.
  const src = await page
    .locator('img[src*="/api/avatar/"]')
    .first()
    .getAttribute('src')
  expect(src).toMatch(/^\/api\/avatar\/[\w-]+\?v=\d+$/)
  const res = await page.request.get(src ?? '')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toBe('image/png')
  expect(res.headers().etag).toBeTruthy()
})

test('baixa os dados da conta em JSON', async () => {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Baixar meus dados' }).click()
  const file = await (await download).path()
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  expect(data.conta.email).toBe(email)
  expect(data.foto?.url).toMatch(/^\/api\/avatar\//)
  const actions = data.auditoria.map((row: { action: string }) => row.action)
  expect(actions).toContain('auth.sign_in')
  expect(actions).toContain('account.avatar_set')
  // O cliente criado lá em cima sai na exportação (src/lib/account-handlers.ts).
  expect(actions).toContain('cliente.created')
  expect(data.clientes.map((c: { nome: string }) => c.nome)).toEqual([
    'Cliente E2E',
  ])
})

test('clientes: apaga com confirmação e a lista volta a ficar vazia', async () => {
  await page.goto('/app/clientes')
  const apagar = page.getByRole('button', { name: 'Apagar Cliente E2E' })
  await waitForHydration(page.getByLabel('Buscar clientes'))
  await apagar.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('não dá para desfazer')).toBeVisible()
  await dialog.getByRole('button', { name: 'Apagar cliente' }).click()

  await expect(page.getByText('Cliente apagado')).toBeVisible()
  await expect(page.getByText('Nenhum cliente por aqui')).toBeVisible()
  await page.goto('/app/configuracoes')
})

test('encerra a conta: sai na hora e /app volta a pedir login', async () => {
  await page.getByRole('button', { name: 'Encerrar conta' }).click()
  const dialog = page.getByRole('dialog')
  const confirm = dialog.getByRole('button', { name: 'Encerrar conta' })
  await expect(confirm).toBeDisabled()
  await dialog.getByLabel(/Digite ENCERRAR/).fill('ENCERRAR')
  await confirm.click()

  await expect(page).toHaveURL(/\/$/)
  await page.goto('/app')
  await expect(page).toHaveURL(/\/login\?redirect=%2Fapp$/)
})
