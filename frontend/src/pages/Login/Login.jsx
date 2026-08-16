import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import styles from './Login.module.css'
import { useToast } from '../../context/ToastContext'
import mascotSoilyi from '../../assets/icons/character_soilyi.png'
import chungjuFarmImg from '../../assets/icons/chungju_farm.jpg'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

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
      await login({ email: form.email, password: form.password })
      showToast('로그인되었습니다. 환영합니다! 🌾', 'success')
      navigate('/home')
    } catch (err) {
      const msg = err.response?.data?.detail || '로그인에 실패했습니다'
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      {/* 🌾 충주 농촌 들녘 배경 사진 & 앰버 웜 글래스 오버레이 */}
      <img src={chungjuFarmImg} alt="충주 농촌 들녘" className={styles.bgPhoto} />
      <div className={styles.bgOverlay} />

      {/* 배경 조명 장식 */}
      <div className={styles.bgOrb1} />
      <div className={styles.bgOrb2} />

      <div className={`glass-card ${styles.card}`}>
        {/* 로고 */}
        <div className={styles.logo}>
          <img src={mascotSoilyi} alt="소일이" className={styles.logoMascotImg} />
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
