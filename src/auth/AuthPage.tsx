import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

const ERRORS: Record<string, string> = {
  'Invalid login credentials': 'Неверный email или пароль',
  'User already registered': 'Пользователь с таким email уже зарегистрирован',
  'Password should be at least 6 characters.': 'Пароль должен быть не короче 6 символов',
  'Email not confirmed': 'Email не подтверждён — проверьте почту',
}

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() } },
        })
        if (error) throw error
        if (!data.session) {
          setInfo('Письмо с подтверждением отправлено на ' + email)
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(ERRORS[msg] ?? msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-3xl">
            ✓
          </div>
          <h1 className="text-2xl font-bold">Задачи</h1>
          <p className="mt-1 text-sm text-ink-dim">Для семьи и работы</p>
        </div>

        <form onSubmit={submit} className="space-y-3 rounded-2xl bg-surface-1 p-6">
          {mode === 'register' && (
            <input
              className="w-full rounded-lg bg-surface-2 px-4 py-2.5 outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-accent"
              placeholder="Ваше имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            className="w-full rounded-lg bg-surface-2 px-4 py-2.5 outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-accent"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full rounded-lg bg-surface-2 px-4 py-2.5 outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-accent"
            placeholder="Пароль (мин. 6 символов)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />

          {error && <p className="text-sm text-p1">{error}</p>}
          {info && <p className="text-sm text-p3">{info}</p>}

          <button
            disabled={busy}
            className="w-full rounded-lg bg-accent py-2.5 font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? '…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-ink-dim">
          {mode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
          <button
            className="font-semibold text-accent hover:underline"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login')
              setError('')
              setInfo('')
            }}
          >
            {mode === 'login' ? 'Создать' : 'Войти'}
          </button>
        </p>
      </div>
    </div>
  )
}
