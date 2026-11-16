import { useCallback, useEffect, useState } from 'react'

function readValue(key, initialValue) {
  try {
    const stored = window.localStorage.getItem(key)
    if (stored === null) return initialValue
    return JSON.parse(stored)
  } catch {
    // Corrupted or unavailable storage (private mode, disabled cookies) — fall back to defaults.
    return initialValue
  }
}

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => readValue(key, initialValue))

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage full or unavailable — the app still works for the current session.
    }
  }, [key, value])

  const reset = useCallback(() => setValue(initialValue), [initialValue])

  return [value, setValue, reset]
}
