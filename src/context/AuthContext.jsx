import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = async (authUser) => {
    if (!authUser) {
      setProfile(null)
      return
    }

    const { data, error } = await supabase
      .from('perfiles')
      .select(`
        id,
        institucion_id,
        nombres,
        apellidos,
        email,
        rol,
        activo
      `)
      .eq('id', authUser.id)
      .single()

    if (error) {
      console.error('ERROR CARGANDO PERFIL:', error)
      setProfile(null)
      return
    }

    setProfile(data)
  }

  useEffect(() => {
    let mounted = true

    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      setUser(session?.user ?? null)

      if (session?.user) {
        await loadProfile(session.user)
      } else {
        setProfile(null)
      }

      setLoading(false)
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      setUser(session?.user ?? null)

      if (event === 'SIGNED_OUT') {
        setProfile(null)
        setLoading(false)
        return
      }

      if (session?.user) {
        setTimeout(() => {
          loadProfile(session.user)
        }, 0)
      } else {
        setProfile(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider')
  }

  return context
}