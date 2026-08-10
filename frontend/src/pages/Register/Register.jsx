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
    email: '', password: '', name: '', role: '', province: '충청북도', city: '',
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
    if (!form.province || !form.city.trim()) { setError('거주 지역(도/시)을 필수 항목으로 입력해 주세요'); return }
    if (form.password.length < 8) { setError('비밀번호는 8자 이상이어야 합니다'); return }
    setError('')
    setLoading(true)
    try {
      const fullLocation = `${form.province} ${form.city.trim()}`
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        location: fullLocation,
      })
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

          {/* 거주 지역 (도, 시 나눠서 필수 입력) */}
          <div className="input-group">
            <label htmlFor="province">
              거주 지역 <span className={styles.required}>(필수)</span>
            </label>
            <div className={styles.locationGrid}>
              <select
                id="province"
                name="province"
                className="input-field"
                value={form.province}
                onChange={handleChange}
                required
              >
                <option value="">도/시 선택</option>
                <option value="충청북도">충청북도 (충북)</option>
                <option value="서울특별시">서울특별시</option>
                <option value="경기도">경기도</option>
                <option value="충청남도">충청남도</option>
                <option value="강원특별자치도">강원특별자치도</option>
                <option value="전라북도">전라북도</option>
                <option value="전라남도">전라남도</option>
                <option value="경상북도">경상북도</option>
                <option value="경상남도">경상남도</option>
                <option value="제주특별자치도">제주특별자치도</option>
                <option value="세종특별자치시">세종특별자치시</option>
                <option value="대전광역시">대전광역시</option>
                <option value="광주광역시">광주광역시</option>
                <option value="대구광역시">대구광역시</option>
                <option value="울산광역시">울산광역시</option>
                <option value="부산광역시">부산광역시</option>
                <option value="인천광역시">인천광역시</option>
              </select>

              {form.province === '충청북도' ? (
                <select
                  id="city"
                  name="city"
                  className="input-field"
                  value={form.city}
                  onChange={handleChange}
                  required
                >
                  <option value="">시/군 선택</option>
                  <option value="청주시">청주시</option>
                  <option value="충주시">충주시</option>
                  <option value="제천시">제천시</option>
                  <option value="보은군">보은군</option>
                  <option value="옥천군">옥천군</option>
                  <option value="영동군">영동군</option>
                  <option value="증평군">증평군</option>
                  <option value="진천군">진천군</option>
                  <option value="괴산군">괴산군</option>
                  <option value="음성군">음성군</option>
                  <option value="단양군">단양군</option>
                </select>
              ) : (
                <input
                  id="city"
                  name="city"
                  type="text"
                  className="input-field"
                  placeholder="시/군/구 입력 (예: 수원시)"
                  value={form.city}
                  onChange={handleChange}
                  required
                />
              )}
            </div>
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
