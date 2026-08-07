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

  // 내 정보 새로고침
  // 로그인 시점에만 user를 저장해두면, 적성검사 재응시로 스텟이 바뀌거나
  // 매칭 신청/취소로 is_seeking이 바뀌어도 캐시된 값이 그대로 남아있게 된다.
  // 스텟/매칭 상태가 바뀔 수 있는 액션(적성검사 제출, 매칭 신청/취소 등) 이후에는
  // 반드시 이 함수로 서버의 최신 값을 다시 받아와 갱신해야 한다.
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
