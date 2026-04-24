import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export function setToken(token: string) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

export function clearToken() {
  delete api.defaults.headers.common['Authorization']
}

export async function login(email: string, password: string) {
  const { data } = await api.post('/auth/login', { email, password })
  return data
}

export async function register(email: string, password: string) {
  const { data } = await api.post('/auth/register', { email, password })
  return data
}

export async function getMe() {
  const { data } = await api.get('/auth/me')
  return data
}

export async function updateProfile(username: string, avatar: string) {
  const { data } = await api.patch('/auth/profile', { username, avatar })
  return data
}

export async function setStartingBalance(balance: number) {
  const { data } = await api.patch('/auth/balance', { balance })
  return data
}

export async function getTickers() {
  const { data } = await api.get('/tickers')
  return data
}

export async function getBalance() {
  const { data } = await api.get('/balance')
  return data
}

export async function getHoldings() {
  const { data } = await api.get('/holdings')
  return data
}

export async function placeOrder(symbol: string, side: string, quantity: number) {
  const { data } = await api.post('/order', { symbol, side, quantity })
  return data
}

export async function getTrades() {
  const { data } = await api.get('/trades')
  return data
}

export async function openLeveraged(symbol: string, direction: string, leverage: number, margin: number) {
  const { data } = await api.post('/leveraged/open', { symbol, direction, leverage, margin })
  return data
}

export async function closeLeveraged(positionID: string) {
  const { data } = await api.post(`/leveraged/close/${positionID}`)
  return data
}

export async function getLeveragedPositions() {
  const { data } = await api.get('/leveraged')
  return data
}