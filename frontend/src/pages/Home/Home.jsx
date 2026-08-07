import { useState, useEffect } from 'react'
import { useAuth } from '../../store/AuthContext'
import { useNavigate } from 'react-router-dom'
import { authAPI, matchingAPI } from '../../api'
import styles from './Home.module.css'



export default function Home() {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [allUsers, setAllUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [myMatch, setMyMatch] = useState(null) // { matched, match_id, task, partner_name, partner_role }

  useEffect(() => {
    // 로그인 시점에 캐시된 내 정보(user)는 스텟/매칭 상태가 최신이 아닐 수 있으므로
    // 홈 화면에 들어올 때마다 서버 최신 값으로 갱신해준다.
    refreshUser?.().catch((err) => console.error('내 정보 갱신 실패:', err))
  }, [])

  useEffect(() => {
    // 가입된 전체 회원 목록 가져오기
    authAPI.getUsers()
      .then(({ data }) => setAllUsers(data))
      .catch((err) => console.error('회원 목록 불러오기 실패:', err))
      .finally(() => setLoadingUsers(false))
  }, [])

  useEffect(() => {
    // 내 매칭 연결 현황 조회 (매칭 표시 / 채팅방 입장 가능 여부 판단용)
    matchingAPI.getMyMatch()
      .then(({ data }) => setMyMatch(data))
      .catch((err) => console.error('매칭 현황 조회 실패:', err))
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // 청년인데 적성검사를 아직 안 해서 스탯이 전부 0인 경우, 매칭 대신 적성검사 페이지로 보냄
  const isStatsEmpty = (u) =>
    !u?.strength && !u?.stamina && !u?.grit && !u?.intelligence &&
    !u?.wage_pref && !u?.personality

  const handleAutoMatching = () => {
    if (user?.role === '청년' && isStatsEmpty(user)) {
      alert('먼저 적성검사를 완료해주세요! 적성검사 페이지로 이동합니다.')
      navigate('/aptitude')
      return
    }
    navigate('/matching')
  }

  // 채팅방 입장: 매칭이 연결되지 않았으면 안내 알림, 연결되어 있으면 해당 채팅방으로 이동
  const handleEnterChat = () => {
    if (!myMatch?.matched) {
      alert('매칭이 아직 안되어 연결할 수 없습니다.')
      return
    }
    navigate(`/chat/${myMatch.match_id}`)
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
              onClick={handleAutoMatching}
            >
              ⚡ AI 자동매칭 시작하기
            </button>
          </div>
        </section>

        {/* 매칭 연결 현황: 매칭이 성사된 경우에만 표시 */}
        {myMatch?.matched && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3>매칭 현황</h3>
            </div>
            <div
              className={`glass-card ${styles.aiMatchingCard}`}
              onClick={handleEnterChat}
              style={{ cursor: 'pointer' }}
            >
              <div className={styles.aiMatchingInfo}>
                <span className={styles.aiMatchingIcon}>🤝</span>
                <div>
                  <strong>
                    매칭이 연결되었습니다! {myMatch.partner_name ? `· ${myMatch.partner_name}(${myMatch.partner_role})` : ''}
                  </strong>
                  <p>{myMatch.task ? `업무: ${myMatch.task} · ` : ''}채팅방을 눌러 대화를 시작해보세요</p>
                </div>
              </div>
              <button
                className={`btn btn-primary ${styles.aiMatchingBtn}`}
                onClick={(e) => { e.stopPropagation(); handleEnterChat() }}
              >
                💬 채팅방 입장하기
              </button>
            </div>
          </section>
        )}

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

        {/* 바로가기 */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>🔗 바로가기</h3>
          </div>
          <div className={`glass-card ${styles.testButtonCard}`}>
            <button
              className={`btn btn-outline ${styles.testBtn}`}
              onClick={() => navigate('/aptitude')}
            >
              🌱 적성검사 하러가기
            </button>
            <button
              className={`btn btn-outline ${styles.testBtn}`}
              onClick={handleAutoMatching}
            >
              🌾 매칭 보러가기
            </button>
            <button
              className={`btn btn-outline ${styles.testBtn}`}
              onClick={() => navigate('/support')}
            >
              🤖 AI 상담사에게 물어보기
            </button>
            <button
              className={`btn btn-outline ${styles.testBtn}`}
              onClick={handleEnterChat}
            >
              [💬 채팅방 테스트 버튼]
            </button>
            <button
              className={`btn btn-outline ${styles.testBtn}`}
              onClick={() => alert('⭐ 리뷰 남기기 기능은 추가 개발 예정입니다!')}
            >
              [⭐ 리뷰 남기기 테스트 버튼]
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

