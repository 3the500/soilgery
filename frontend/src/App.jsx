import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './store/AuthContext'
import Login from './pages/Login/Login'
import Register from './pages/Register/Register'
import Home from './pages/Home/Home'
import Profile from './pages/Profile/Profile'
import Aptitude from './pages/Aptitude/Aptitude'
import Matching from './pages/Matching/Matching'
import Support from './pages/Support/Support'
import Chat from './pages/Chat/Chat' // Chat 컴포넌트 불러오기

// 로그인 안 했으면 /login으로 리다이렉트
function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" replace />
}

// 로그인 했으면 /home으로 리다이렉트
function PublicRoute({ children }) {
  const { user } = useAuth()
  return user ? <Navigate to="/home" replace /> : children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      
      {/* 로그인한 사용자만 접근 가능한 인증된 페이지 목록 */}
      <Route path="/home" element={<PrivateRoute><Home /></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
      <Route path="/aptitude" element={<PrivateRoute><Aptitude /></PrivateRoute>} />
      <Route path="/matching" element={<PrivateRoute><Matching /></PrivateRoute>} />
      <Route path="/support" element={<PrivateRoute><Support /></PrivateRoute>} />

      {/* 채팅 관련 라우트 추가 */}
      <Route path="/chat" element={<PrivateRoute><Chat /></PrivateRoute>} />
      <Route path="/chat/:matchId" element={<PrivateRoute><Chat /></PrivateRoute>} />

      {/* 그 외 지정되지 않은 주소로 접속 시 /home으로 리다이렉트 */}
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}