import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import styles from './Register.module.css'

const ROLES = [
  { value: '청년', emoji: '🌱', label: '청년', desc: '농촌 체험·부업을 원해요', key: 'youth' },
  { value: '농부', emoji: '👨‍🌾', label: '농부', desc: '일손이 필요해요', key: 'farmer' },
]

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    email: '', password: '', name: '', role: '', location: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const selectRole = (role) =>
    setForm((prev) => ({ ...prev, role }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.role) { setError('나는 어떤 사람인지(청년/농부) 선택해 주세요'); return }
    if (form.password.length < 8) { setError('비밀번호는 8자 이상이어야 합니다'); return }
    setError('')
    setLoading(true)
    try {
      await register(form)
      navigate('/home')
    } catch (err) {
      console.error('회원가입 에러:', err)
      const detail = err.response?.data?.detail
      let msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail[0]?.msg : null)
      if (!msg) {
        msg = err.message ? `통신 에러: ${err.message}` : '회원가입에 실패했습니다.'
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.bgOrb1} />
      <div className={styles.bgOrb2} />

      <div className={`glass-card ${styles.card}`}>
        <div className={styles.header}>
          <span className={styles.headerIcon}>🌱</span>
          <h1>소일거리 가입</h1>
          <p>충북 농촌과 청년을 잇는 첫걸음</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* 역할 선택 */}
          <div className={styles.roleSection}>
            <p className={styles.roleLabel}>나는 어떤 사람인가요?</p>
            <div className={styles.roleGrid}>
              {ROLES.map((r) => {
                const isActive = form.role === r.value
                const activeClass = isActive
                  ? r.key === 'farmer'
                    ? styles.roleCardActiveFarmer
                    : styles.roleCardActiveYouth
                  : ''

                return (
                  <button
                    key={r.value}
                    type="button"
                    className={`${styles.roleCard} ${activeClass}`}
                    onClick={() => selectRole(r.value)}
                  >
                    <span className={styles.roleEmoji}>{r.emoji}</span>
                    <strong>{r.label}</strong>
                    <span className={styles.roleDesc}>{r.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="name">이름</label>
            <input
              id="name" name="name" type="text"
              className="input-field" placeholder="홍길동"
              value={form.name} onChange={handleChange} required
            />
          </div>

          <div className="input-group">
            <label htmlFor="reg-email">이메일</label>
            <input
              id="reg-email" name="email" type="email"
              className="input-field" placeholder="example@email.com"
              value={form.email} onChange={handleChange} required
              autoComplete="email"
            />
          </div>

          <div className="input-group">
            <label htmlFor="reg-password">비밀번호</label>
            <input
              id="reg-password" name="password" type="password"
              className="input-field" placeholder="8자 이상 입력"
              value={form.password} onChange={handleChange} required minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div className="input-group">
            <label htmlFor="location">거주 지역 <span className={styles.optional}>(선택)</span></label>
            <input
              id="location" name="location" type="text"
              className="input-field" placeholder="예: 충북 청주시"
              value={form.location} onChange={handleChange}
            />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button
            type="submit"
            className={`btn btn-primary ${loading ? styles.loading : ''}`}
            disabled={loading}
          >
            {loading ? '가입 및 로그인 처리 중...' : '가입하고 바로 시작하기'}
          </button>
        </form>

        <p className={styles.loginLink}>
          이미 계정이 있으신가요? <Link to="/login">로그인</Link>
        </p>
      </div>
    </div>
  )
}
