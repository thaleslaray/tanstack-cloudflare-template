import { useCallback, useEffect, useState } from 'react'

// Contagem regressiva em segundos para o "Reenviar código": `start()` liga,
// `left` diz quantos segundos faltam (0 = liberado).
export const RESEND_COOLDOWN_SECONDS = 60

export function useCooldown() {
  const [left, setLeft] = useState(0)

  useEffect(() => {
    if (left <= 0) return
    const timer = setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => clearTimeout(timer)
  }, [left])

  const start = useCallback(() => setLeft(RESEND_COOLDOWN_SECONDS), [])
  return { left, start }
}
