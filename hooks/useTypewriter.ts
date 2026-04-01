import { useState, useEffect } from 'react'

export function useTypewriter(text: string | null, charsPerSec = 120): string {
  const [displayed, setDisplayed] = useState(text ?? '')

  useEffect(() => {
    if (!text) {
      setDisplayed('')
      return
    }
    setDisplayed('')
    let i = 0
    const delay = 1000 / charsPerSec
    const id = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(id)
    }, delay)
    return () => clearInterval(id)
  }, [text, charsPerSec])

  return displayed
}
