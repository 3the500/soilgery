import { createContext, useContext, useState } from 'react'
import { authAPI } from '../api/index'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user')
    return savedUser ? JSON.parse(savedUser) : null
  })

  // 💡 회원가입 완료 즉시 자동 로그인 수행
  const register = async (formData) => {
    // 1. 회원가입 요청
    const response = await authAPI.register(formData)
    
    // 2. 가입 완료 즉시 로그인 API 호출 및 세션 토큰 저장
    await login({
      email: formData.email,
      password: formData.password
    })

    return response.data
  }

  // 로그인
  const login = async (credentials) => {
    const response = await authAPI.login(credentials)
    const { access_token } = response.data
    
    // 토큰 저장
    localStorage.setItem('token', access_token)
    
    // 내 정보 조회
    const meRes = await authAPI.me()
    setUser(meRes.data)
    localStorage.setItem('user', JSON.stringify(meRes.data))
    return meRes.data
  }

  // 로그아웃
  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  // 내 정보 새로고침
  const refreshUser = async () => {
    const token = localStorage.getItem('token')
    if (!token) return null
    const meRes = await authAPI.me()
    setUser(meRes.data)
    localStorage.setItem('user', JSON.stringify(meRes.data))
    return meRes.data
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
