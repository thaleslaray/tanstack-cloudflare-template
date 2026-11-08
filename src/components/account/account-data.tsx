import { DownloadIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { ACCOUNT_RETENTION_DAYS } from '#/lib/account'
import { closeAccountFn, exportMyDataFn } from '#/lib/account-fns'
import { authClient } from '#/lib/auth-client'

// "Baixar meus dados": o JSON montado pelo onAccountExport de cada módulo.
export function DownloadMyData() {
  const [busy, setBusy] = useState(false)

  async function download() {
    setBusy(true)
    try {
      const data = await exportMyDataFn()
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `meus-dados-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Não foi possível gerar o arquivo. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">Seus dados</p>
        <p className="text-sm text-muted-foreground">
          Um arquivo JSON com tudo o que guardamos sobre a sua conta.
        </p>
      </div>
      <Button variant="outline" disabled={busy} onClick={() => void download()}>
        <DownloadIcon className="size-4" />
        {busy ? 'Gerando...' : 'Baixar meus dados'}
      </Button>
    </div>
  )
}

const CONFIRM_WORD = 'ENCERRAR'

// Encerrar a conta (fase 1 de 2, src/lib/account.ts): a pessoa sai na hora e
// o cron apaga tudo depois do prazo. Pede para digitar uma palavra: é o tipo
// de botão que ninguém deve apertar sem querer.
export function CloseAccount() {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmed = typed.trim().toUpperCase() === CONFIRM_WORD

  async function close() {
    setBusy(true)
    setError(null)
    try {
      await closeAccountFn()
    } catch (err) {
      setBusy(false)
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Não foi possível encerrar a conta. Tente de novo.',
      )
      return
    }
    // As sessões já caíram no servidor; isto só limpa o cookie do navegador.
    await authClient.signOut().catch(() => {})
    window.location.assign('/')
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">Encerrar conta</p>
        <p className="text-sm text-muted-foreground">
          Você sai na hora; os dados são apagados de vez em{' '}
          {ACCOUNT_RETENTION_DAYS} dias.
        </p>
      </div>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (busy) return
          setOpen(next)
          setTyped('')
          setError(null)
        }}
      >
        <DialogTrigger asChild>
          <Button variant="destructive">Encerrar conta</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar sua conta?</DialogTitle>
            <DialogDescription>
              Todas as suas sessões serão desconectadas e você não conseguirá
              mais entrar. Daqui a {ACCOUNT_RETENTION_DAYS} dias, a conta, a
              foto e os dados ligados a ela serão apagados para sempre. Até lá,
              o suporte ainda consegue restaurar.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (confirmed && !busy) void close()
            }}
          >
            <Label htmlFor="confirm-close">
              Digite {CONFIRM_WORD} para confirmar
            </Label>
            <Input
              id="confirm-close"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              disabled={busy}
            />
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={busy}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button
                type="submit"
                variant="destructive"
                disabled={!confirmed || busy}
              >
                {busy ? 'Encerrando...' : 'Encerrar conta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
