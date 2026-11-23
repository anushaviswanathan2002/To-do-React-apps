let token = sessionStorage.getItem('lib_token') || null

export const setToken = (t) => {
  token = t
  if (t) sessionStorage.setItem('lib_token', t)
  else sessionStorage.removeItem('lib_token')
}
export const hasToken = () => Boolean(token)

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export const money = (cents) => `$${(cents / 100).toFixed(2)}`
