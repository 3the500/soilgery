import { useState, useEffect } from 'react'
import { useAuth } from '../../store/AuthContext'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '../../api'
import styles from './Home.module.css'



export default function Home() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [allUsers, setAllUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)

  useEffect(() => {
    // 가입된 전체 회원 목록 가져오기
    authAPI.getUsers()
      .then(({ data }) => setAllUsers(data))
      .catch((err) => console.error('회원 목록 불러오기 실패:', err))
      .finally(() => setLoadingUsers(false))
  }, [])

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
          <div className={styles.userBadge} onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
            <span className={styles.userRole}>{user?.role}</span>
            <span className={styles.userName}>{user?.name}</span>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>로그아웃</button>
        </div>
      </header>

      <main className={styles.main}>
        {/* 배너 */}
        <section className={styles.banner}>
          <div className={styles.bannerText}>
            <h2 className={styles.bannerTitle}>
              오늘의 추천 매칭을<br />확인해보세요
            </h2>
            <p className={styles.bannerSub}>AI가 분석한 최적의 매칭 결과예요</p>
          </div>
          <div className={styles.bannerDecor}>🌾</div>
        </section>

        {/* 👥 전체 가입 회원 현황 (관리) */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>전체 회원 현황</h3>
            <span className={styles.userCountBadge}>총 {allUsers.length}명</span>
          </div>

          <div className={`glass-card ${styles.userListCard}`}>
            {loadingUsers ? (
              <p className={styles.emptyText}>회원 목록을 불러오는 중...</p>
            ) : allUsers.length === 0 ? (
              <p className={styles.emptyText}>가입된 회원이 없습니다.</p>
            ) : (
              <div className={styles.userTable}>
                {allUsers.map((u) => (
                  <div key={u.id} className={styles.userRow}>
                    <div className={styles.userInfo}>
                      <span className={styles.userAvatar}>
                        {u.role === '농부' ? '👨‍🌾' : '🧑‍🌾'}
                      </span>
                      <div>
                        <div className={styles.userNameGroup}>
                          <strong>{u.name}</strong>
                          <span className={`${styles.roleBadge} ${u.role === '농부' ? styles.farmerBadge : styles.youthBadge}`}>
                            {u.role}
                          </span>
                          <span className={styles.ratingBadge}>⭐ {u.rating ? Number(u.rating).toFixed(1) : '0.0'}</span>
                        </div>
                        <p className={styles.userSubInfo}>{u.email} {u.location ? `· 📍${u.location}` : ''}</p>
                        <div className={styles.statBadges}>
                          <span>💪근력:{u.strength ?? 0}</span>
                          <span>⚡체력:{u.stamina ?? 0}</span>
                          <span>🔥근성:{u.grit ?? 0}</span>
                          <span>🧠지성:{u.intelligence ?? 0}</span>
                        </div>
                      </div>
                    </div>
                    <span className={styles.joinDate}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('ko-KR') : '최근'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* AI 자동매칭 버튼 섹션 */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3>AI 자동매칭</h3>
            <span className={styles.badge}>ML 기반</span>
          </div>

          <div className={`glass-card ${styles.aiMatchingCard}`}>
            <div className={styles.aiMatchingInfo}>
              <span className={styles.aiMatchingIcon}>🤖</span>
              <div>
                <strong>나에게 꼭 맞는 맞춤 일자리 찾기</strong>
                <p>AI가 유형검사 결과와 위치를 바탕으로 매칭해 드립니다</p>
              </div>
            </div>
            <button
              className={`btn btn-primary ${styles.aiMatchingBtn}`}
              onClick={() => alert('AI 자동매칭 기능은 친구1이 구현 예정입니다! 🌱')}
            >
              ⚡ AI 자동매칭 시작하기
            </button>
          </div>
        </section>

        {/* 내 정보 카드 */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>내 정보</h3>
            <span className={styles.detailLink} onClick={() => navigate('/profile')}>상세보기 →</span>
          </div>
          <div className={`glass-card ${styles.profileCard}`} onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }}>
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

        {/* 🧪 추가 예정 기능 테스트 버튼 목록 */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>🧪 개발 예정 기능 테스트</h3>
          </div>
          <div className={`glass-card ${styles.testButtonCard}`}>
            <button
              className={`btn btn-outline ${styles.testBtn}`}
              onClick={() => alert('💬 채팅방 기능은 추가 개발 예정입니다!')}
            >
              [💬 채팅방 테스트 버튼]
            </button>
            <button
              className={`btn btn-outline ${styles.testBtn}`}
              onClick={() => alert('⭐ 리뷰 남기기 기능은 추가 개발 예정입니다!')}
            >
              [⭐ 리뷰 남기기 테스트 버튼]
            </button>
            <button
              className={`btn btn-outline ${styles.testBtn}`}
              onClick={() => alert('🤖 AI 고객센터 챗봇 기능은 추가 개발 예정입니다!')}
            >
              [🤖 AI 고객센터 테스트 버튼]
            </button>
            <button
              className={`btn btn-outline ${styles.testBtn}`}
              onClick={() => alert('🌾 일자리 매칭 기능은 추가 개발 예정입니다!')}
            >
              [🌾 일자리 매칭 테스트 버튼]
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

