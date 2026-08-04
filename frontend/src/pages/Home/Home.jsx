import { useAuth } from '../../store/AuthContext'
import { useNavigate } from 'react-router-dom'
import styles from './Home.module.css'

// 임시 더미 매칭 카드 데이터
const DUMMY_MATCHES = [
  { id: 1, name: '김철수', role: '농부', location: '충북 청주시', crop: '고구마', reward: '농산물', score: 92 },
  { id: 2, name: '이영희', role: '농부', location: '충북 옥천군', crop: '사과', reward: '현금', score: 87 },
  { id: 3, name: '박민준', role: '청년', location: '충북 충주시', crop: '-', reward: '-', score: 81 },
]

export default function Home() {
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
          <span className={styles.logo}>🌱 소일거리</span>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.userBadge}>
            <span className={styles.userRole}>{user?.role}</span>
            <span className={styles.userName}>{user?.name}</span>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>로그아웃</button>
        </div>
      </header>

      <main className={styles.main}>
        {/* 환영 배너 */}
        <section className={styles.banner}>
          <div className={styles.bannerText}>
            <p className={styles.bannerGreet}>안녕하세요, {user?.name}님 👋</p>
            <h2 className={styles.bannerTitle}>
              오늘의 추천 매칭을<br />확인해보세요
            </h2>
            <p className={styles.bannerSub}>AI가 분석한 최적의 매칭 결과예요</p>
          </div>
          <div className={styles.bannerDecor}>🌾</div>
        </section>

        {/* 매칭 리스트 */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>추천 매칭</h3>
            <span className={styles.badge}>AI 추천</span>
          </div>

          <div className={styles.matchList}>
            {DUMMY_MATCHES.map((m) => (
              <div key={m.id} className={`glass-card ${styles.matchCard}`}>
                <div className={styles.matchTop}>
                  <div className={styles.matchAvatar}>
                    {m.role === '농부' ? '👨‍🌾' : '🧑‍🌾'}
                  </div>
                  <div className={styles.matchInfo}>
                    <strong>{m.name}</strong>
                    <span className={styles.matchRole}>{m.role}</span>
                    <span className={styles.matchLocation}>📍 {m.location}</span>
                  </div>
                  <div className={styles.matchScore}>
                    <span className={styles.scoreNum}>{m.score}</span>
                    <span className={styles.scoreLabel}>궁합</span>
                  </div>
                </div>

                {m.role === '농부' && (
                  <div className={styles.matchTags}>
                    <span className={styles.tag}>🌱 {m.crop}</span>
                    <span className={styles.tag}>💰 {m.reward}</span>
                  </div>
                )}

                <button className={`btn btn-primary ${styles.matchBtn}`}>
                  매칭 신청
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* 내 정보 카드 */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>내 정보</h3>
          <div className={`glass-card ${styles.profileCard}`}>
            <div className={styles.profileRow}>
              <span className={styles.profileLabel}>이름</span>
              <span>{user?.name}</span>
            </div>
            <div className={styles.profileRow}>
              <span className={styles.profileLabel}>이메일</span>
              <span>{user?.email}</span>
            </div>
            <div className={styles.profileRow}>
              <span className={styles.profileLabel}>역할</span>
              <span className={styles.roleTag}>{user?.role}</span>
            </div>
            <div className={styles.profileRow}>
              <span className={styles.profileLabel}>지역</span>
              <span>{user?.location || '미설정'}</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
