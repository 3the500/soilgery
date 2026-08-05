import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import styles from './Login.module.css'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)


  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/home')
    } catch (err) {
      setError(err.response?.data?.detail || '로그인에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      {/* 배경 장식 */}
      <div className={styles.bgOrb1} />
      <div className={styles.bgOrb2} />

      <div className={`glass-card ${styles.card}`}>
        {/* 로고 */}
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🌱</span>
          <h1 className={styles.logoText}>소일거리</h1>
          <p className={styles.logoSub}>충북 청년 × 농부 AI 매칭</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className="input-group">
            <label htmlFor="email">이메일</label>
            <input
              id="email"
              name="email"
              type="email"
              className="input-field"
              placeholder="example@email.com"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="email"
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              name="password"
              type="password"
              className="input-field"
              placeholder="비밀번호 입력"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button
            type="submit"
            className={`btn btn-primary ${loading ? styles.loading : ''}`}
            disabled={loading}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>


        <p className={styles.registerLink}>
          아직 계정이 없으신가요?{' '}
          <Link to="/register">회원가입</Link>
        </p>
      </div>
    </div>
  )
}
