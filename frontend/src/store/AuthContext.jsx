import { createContext, useContext, useState } from 'react'
import { authAPI } from '../api/index'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user')
    return savedUser ? JSON.parse(savedUser) : null
  })

  // 회원가입
  const register = async (formData) => {
    const response = await authAPI.register(formData)
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

  return (
    <AuthContext.Provider value={{ user, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)