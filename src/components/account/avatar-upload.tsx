import { useQueryClient } from '@tanstack/react-query'
import { ImageUpIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
import { Button } from '#/components/ui/button'
import { Label } from '#/components/ui/label'
import { authClient } from '#/lib/auth-client'
import { AVATAR_ACCEPT, checkAvatarFile } from '#/lib/avatar'

export function initials(name: string, email: string) {
  const source = name.trim() || email
  return source.charAt(0).toUpperCase() || 'U'
}

// Foto de perfil: escolhe o arquivo, mostra a prévia e envia para
// POST /api/avatar (src/routes/api/avatar.ts), que grava no R2.
export function AvatarUpload({
  user,
}: {
  user: { name: string; email: string; image?: string | null }
}) {
  const queryClient = useQueryClient()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  // A prévia é uma URL local do navegador; libera a memória ao trocar.
  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0] ?? null
    setError(null)
    if (!chosen) return setFile(null)
    // Mesma regra do servidor, aqui só para avisar antes de enviar.
    const problem = checkAvatarFile(chosen)
    if (problem) {
      setError(problem.message)
      setFile(null)
      event.target.value = ''
      return
    }
    setFile(chosen)
  }

  function cancel() {
    setFile(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function send() {
    if (!file) return
    setSending(true)
    const body = new FormData()
    body.append('file', file)
    const response = await fetch('/api/avatar', { method: 'POST', body }).catch(
      () => null,
    )
    setSending(false)
    if (!response?.ok) {
      const message = response
        ? await response.text()
        : 'Sem conexão. Tente de novo.'
      setError(message || 'Não foi possível enviar a foto.')
      return
    }
    cancel()
    // Atualiza a sessão nesta página e no avatar do cabeçalho.
    await queryClient.invalidateQueries({ queryKey: ['session'] })
    authClient.$store.notify('$sessionSignal')
    toast.success('Foto atualizada')
  }

  const shown = preview ?? user.image ?? null

  return (
    <div className="grid gap-3">
      <Label htmlFor={inputId}>Foto de perfil</Label>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="size-16">
          {shown ? <AvatarImage src={shown} alt="" /> : null}
          <AvatarFallback>{initials(user.name, user.email)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={AVATAR_ACCEPT}
            onChange={pick}
            className="sr-only"
          />
          {file ? (
            <>
              <Button
                type="button"
                disabled={sending}
                onClick={() => void send()}
                variant="brand"
              >
                {sending ? 'Enviando...' : 'Salvar foto'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={sending}
                onClick={cancel}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
            >
              <ImageUpIcon className="size-4" />
              Escolher imagem
            </Button>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        PNG, JPEG ou WebP, até 2 MB.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
