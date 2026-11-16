import { useEffect, useState } from 'react'
import { todayDateValue } from '../utils/dates.js'

// Keeps "today" accurate if the app stays open across midnight, so overdue
// highlighting never goes stale.
export function useToday() {
  const [today, setToday] = useState(() => todayDateValue())

  useEffect(() => {
    const now = new Date()
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5)
    const timeout = setTimeout(() => setToday(todayDateValue()), nextMidnight - now)
    return () => clearTimeout(timeout)
  }, [today])

  return today
}
