import { env } from 'cloudflare:workers'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { sendEmail, sendEmailSafely } from './email'

const params = {
  to: 'ana@exemplo.com',
  subject: 'Olá',
  html: '<p>Oi</p>',
  text: 'Oi',
}

// No teste, `env` é o stub mutável de src/test/cloudflare-workers.ts.
const stubEnv = env as unknown as Record<string, unknown>

beforeEach(() => {
  for (const key of Object.keys(stubEnv)) delete stubEnv[key]
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('sendEmail', () => {
  it('sem provedor configurado imprime no console e não envia', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const result = await sendEmail(params)
    expect(result).toEqual({ sent: false, provider: 'console' })
    expect(log).toHaveBeenCalledOnce()
  })

  it('trata chave vazia como ausente', async () => {
    Object.assign(stubEnv, { RESEND_API_KEY: '   ' })
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const result = await sendEmail(params)
    expect(result.provider).toBe('console')
  })

  it('com RESEND_API_KEY faz POST na API do Resend com Bearer', async () => {
    Object.assign(stubEnv, { RESEND_API_KEY: 're_teste' })
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: 'abc123' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendEmail(params)

    expect(result).toEqual({ sent: true, provider: 'resend', id: 'abc123' })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer re_teste',
    )
    const body = JSON.parse(init.body as string)
    expect(body.to).toBe(params.to)
    expect(body.subject).toBe(params.subject)
  })

  it('erro HTTP do Resend lança com o status', async () => {
    Object.assign(stubEnv, { RESEND_API_KEY: 're_teste' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('chave inválida', { status: 401 })),
    )
    await expect(sendEmail(params)).rejects.toThrow(/401/)
  })

  it('com binding EMAIL e EMAIL_FROM (sem Resend) usa o Cloudflare', async () => {
    const send = vi.fn(async () => ({ messageId: 'cf-1' }))
    Object.assign(stubEnv, {
      EMAIL: { send },
      EMAIL_FROM: 'App <oi@exemplo.com>',
    })

    const result = await sendEmail(params)

    expect(result).toEqual({ sent: true, provider: 'cloudflare', id: 'cf-1' })
    expect(send).toHaveBeenCalledOnce()
  })

  it('erro do binding do Cloudflare lança com mensagem em pt-BR', async () => {
    Object.assign(stubEnv, {
      EMAIL: {
        send: vi.fn(async () => {
          throw Object.assign(new Error('falhou'), { code: 'E_X' })
        }),
      },
      EMAIL_FROM: 'oi@exemplo.com',
    })
    await expect(sendEmail(params)).rejects.toThrow(
      /Cloudflare Email Service \(E_X\)/,
    )
  })
})

describe('sendEmailSafely', () => {
  it('engole o erro e só registra no console', async () => {
    Object.assign(stubEnv, { RESEND_API_KEY: 're_teste' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('erro', { status: 500 })),
    )
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(sendEmailSafely(params)).resolves.toBeUndefined()
    expect(error).toHaveBeenCalledOnce()
  })
})
