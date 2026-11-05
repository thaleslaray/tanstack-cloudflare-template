import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import { authClient } from '#/lib/auth-client'
import { authProvidersQuery } from '#/lib/auth-queries'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12c0 5.08 3.29 9.38 7.86 10.9.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}

export function SocialButtons({ callbackURL }: { callbackURL: string }) {
  const { data } = useQuery(authProvidersQuery)
  const [pending, setPending] = useState(false)

  if (!data || (!data.google && !data.github)) return null

  function go(provider: 'google' | 'github') {
    setPending(true)
    // O clique leva para fora do site: o botão fica travado de propósito.
    void authClient.signIn.social({
      provider,
      callbackURL,
      errorCallbackURL: '/login',
    })
  }

  return (
    <>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="flex flex-col gap-2">
        {data.google ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="h-11 w-full"
            onClick={() => go('google')}
          >
            <GoogleIcon />
            Continuar com Google
          </Button>
        ) : null}
        {data.github ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="h-11 w-full"
            onClick={() => go('github')}
          >
            <GithubIcon />
            Continuar com GitHub
          </Button>
        ) : null}
      </div>
    </>
  )
}
