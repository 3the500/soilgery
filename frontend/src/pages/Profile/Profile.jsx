import { useAuth } from '../../store/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import styles from './Profile.module.css'

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className={styles.wrapper}>
      {/* 배경 */}
      <div className={styles.bgOrb} />

      {/* 상단 헤더 */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to="/home" className={styles.backBtn}>← 홈으로</Link>
        </div>
        <h1 className={styles.headerTitle}>내 개인정보</h1>
        <button className={styles.logoutBtn} onClick={handleLogout}>로그아웃</button>
      </header>

      <main className={styles.main}>
        {/* 프로필 카드 상단 */}
        <section className={`glass-card ${styles.userMainCard}`}>
          <div className={styles.avatarArea}>
            <span className={styles.avatarEmoji}>
              {user?.role === '농부' ? '👨‍🌾' : '🧑‍🌾'}
            </span>
          </div>
          <h2 className={styles.userName}>{user?.name}</h2>
          <span className={styles.userRoleTag}>{user?.role}</span>
          <div className={styles.ratingBox}>
            <span>⭐ 평점</span>
            <strong>{user?.rating ? Number(user?.rating).toFixed(1) : '0.0'} / 5.0</strong>
          </div>
        </section>

        {/* 기본 계정 정보 */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>📋 기본 계정 정보</h3>
          <div className={`glass-card ${styles.infoCard}`}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>이름</span>
              <span className={styles.infoValue}>{user?.name}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>이메일</span>
              <span className={styles.infoValue}>{user?.email}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>회원 유형</span>
              <span className={styles.infoValue}>{user?.role}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>거주 지역</span>
              <span className={styles.infoValue}>{user?.location || '미설정'}</span>
            </div>
          </div>
        </section>

        {/* 스탯 정보 */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>📊 내 매칭 스탯</h3>
          <div className={`glass-card ${styles.statsGrid}`}>
            <div className={styles.statBox}>
              <span className={styles.statIcon}>💪</span>
              <span className={styles.statName}>근력</span>
              <strong className={styles.statVal}>{user?.strength ?? 0}</strong>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statIcon}>⚡</span>
              <span className={styles.statName}>체력</span>
              <strong className={styles.statVal}>{user?.stamina ?? 0}</strong>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statIcon}>🔥</span>
              <span className={styles.statName}>근성</span>
              <strong className={styles.statVal}>{user?.grit ?? 0}</strong>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statIcon}>🧠</span>
              <span className={styles.statName}>지성</span>
              <strong className={styles.statVal}>{user?.intelligence ?? 0}</strong>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statIcon}>💰</span>
              <span className={styles.statName}>급여</span>
              <strong className={styles.statVal}>{user?.wage_pref ?? 0}</strong>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statIcon}>😊</span>
              <span className={styles.statName}>성격</span>
              <strong className={styles.statVal}>{user?.personality ?? 0}</strong>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
