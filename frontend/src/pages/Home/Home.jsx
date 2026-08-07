import { useState, useEffect } from 'react'
import { useAuth } from '../../store/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authAPI, matchingAPI, reviewAPI } from '../../api'
import styles from './Home.module.css'

export default function Home() {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [allUsers, setAllUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [adminUserRoleFilter, setAdminUserRoleFilter] = useState('all') // 'all' | 'farmer' | 'youth'

  const [myMatches, setMyMatches] = useState([])
  const [loadingMatches, setLoadingMatches] = useState(true)

  // ⭐️ 리뷰 데이터 상태
  const [reviewsData, setReviewsData] = useState({ given: [], received: [] })
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [reviewTabSub, setReviewTabSub] = useState('received') // 'received' | 'given'

  // ✏️ 내 정보 수정 모달 상태 및 폼 데이터
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [submittingEdit, setSubmittingEdit] = useState(false)
  const [editFormData, setEditFormData] = useState({
    name: '',
    location: '',
    is_seeking: true,
  })

  // 💬 안 읽은 새 메시지 카운트 상태
  const [unreadCount, setUnreadCount] = useState(0)

  // 🔔 알림 데이터 & 뱃지 상태
  const [notifications, setNotifications] = useState([])
  const [noticeBadgeCount, setNoticeBadgeCount] = useState(0)

  // 📱 5대 하단 탭 상태: URL 쿼리파라미터 tab이 있으면 우선 적용, 기본값 'matching'
  const initialTab = searchParams.get('tab') || 'matching'
  const [bottomTab, setBottomTab] = useState(initialTab)

  // 상단 우측 탭 상태: 'notice' (알림), 'menu' (메뉴: 관리자 기능), 'settings' (설정), null
  const [activeHeaderTab, setActiveHeaderTab] = useState(null)

  const isFarmer = user?.role === '농부'
  const isStatsEmpty = (u) =>
    !u?.strength && !u?.stamina && !u?.grit && !u?.intelligence &&
    !u?.wage_pref && !u?.personality

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam) {
      setBottomTab(tabParam)
    }
  }, [searchParams])

  useEffect(() => {
    refreshUser?.().catch((err) => console.error('내 정보 갱신 실패:', err))
  }, [])

  // ✏️ 내 정보 수정 모달 열기 시 폼 데이터 초기화
  const handleOpenEditProfile = () => {
    if (!user) return
    setEditFormData({
      name: user.name || '',
      location: user.location || '전라도',
      is_seeking: user.is_seeking !== false,
    })
    setIsEditProfileOpen(true)
  }

  // ✏️ 내 정보 수정 저장 처리
  const handleSubmitEditProfile = async (e) => {
    e.preventDefault()
    if (!editFormData.name.trim()) {
      alert('이름을 입력해주세요.')
      return
    }

    setSubmittingEdit(true)
    try {
      await authAPI.updateMe({
        name: editFormData.name.trim(),
        location: editFormData.location,
        is_seeking: editFormData.is_seeking,
      })

      await refreshUser()
      setIsEditProfileOpen(false)
      alert('내 정보가 성공적으로 수정되었습니다! 🎉')
    } catch (err) {
      console.error('내 정보 수정 실패:', err)
      alert(err.response?.data?.detail || '내 정보 수정 중 오류가 발생했습니다.')
    } finally {
      setSubmittingEdit(false)
    }
  }

  // 🔔 환영 알림 및 리뷰/파기 알림 자동 계산
  useEffect(() => {
    if (!user) return

    const isWelcomeDismissed = localStorage.getItem(`dismissed_welcome_notice_${user.id}`) === 'true'
    const savedDismissed = JSON.parse(localStorage.getItem(`dismissed_notices_${user.id}`) || '[]')
    const list = []

    // 1. 환영 및 적성검사 유도 알림
    if (!isFarmer && !isWelcomeDismissed) {
      list.push({
        id: 'welcome',
        type: 'welcome',
        canDismiss: false,
        title: '🌱 소일거리 가입을 환영합니다!',
        desc: '정확한 농가 맞춤 추천을 위해 적성검사를 진행해보세요.',
        btnText: '🌱 적성검사 하러가기',
        action: () => {
          localStorage.setItem(`dismissed_welcome_notice_${user.id}`, 'true')
          setActiveHeaderTab(null)
          navigate('/aptitude')
        }
      })
    }

    // 2. 파기(상대방 나감)된 채팅방 조언 알림
    const brokenMatches = myMatches.filter((m) => m.partner_left)
    if (brokenMatches.length > 0) {
      const isSeeking = user.is_seeking !== false
      const matchNoticeId = 'broken_match'
      if (!savedDismissed.includes(matchNoticeId)) {
        list.push({
          id: matchNoticeId,
          type: 'match',
          canDismiss: true,
          title: '💬 채팅방 대화가 종료되었습니다',
          desc: isSeeking
            ? `상대방이 채팅방을 나갔습니다. 현재 [${isFarmer ? '구인 중' : '구직 중'}] 상태입니다. 새로운 소일거리 매칭을 기다려보세요! 🌾`
            : `상대방이 채팅방을 나갔습니다. 현재 매칭 일시정지 상태입니다. 새로운 소일거리를 찾기 위해 [⚡ AI 매칭]을 다시 시작해보는 건 어떨까요? 🌱`,
          btnText: isSeeking ? '⚡ 매칭 현황 보기' : '⚡ AI 자동매칭 다시 시작하기',
          action: () => {
            setActiveHeaderTab(null)
            setBottomTab('matching')
            setSearchParams({ tab: 'matching' })
          }
        })
      }
    }

    // 3. 최근 수신된 리뷰 알림
    if (reviewsData.received.length > 0) {
      const latestRev = reviewsData.received[reviewsData.received.length - 1]
      const revNoticeId = `review_${latestRev.id}`
      if (!savedDismissed.includes(revNoticeId)) {
        list.push({
          id: revNoticeId,
          type: 'review',
          canDismiss: true,
          title: `⭐ ${latestRev.reviewer_name}님의 새로운 리뷰 도착!`,
          desc: `"${latestRev.comment || '따뜻한 후기를 남겼습니다.'}" (평점: ⭐ ${latestRev.rating}점)`,
          btnText: '⭐ 리뷰 관리 탭 이동',
          action: () => {
            setActiveHeaderTab(null)
            setBottomTab('review')
            setSearchParams({ tab: 'review' })
          }
        })
      }
    }

    setNotifications(list)

    const hasSeenNotice = localStorage.getItem(`seen_notice_count_${user.id}`) === String(list.length)
    if (!hasSeenNotice && list.length > 0) {
      setNoticeBadgeCount(list.length)
    } else {
      setNoticeBadgeCount(0)
    }
  }, [user, isFarmer, myMatches, reviewsData])

  // ✕ 알림 개별 삭제/닫기
  const handleDismissNotice = (noticeId) => {
    if (!user) return
    const saved = JSON.parse(localStorage.getItem(`dismissed_notices_${user.id}`) || '[]')
    if (!saved.includes(noticeId)) {
      saved.push(noticeId)
      localStorage.setItem(`dismissed_notices_${user.id}`, JSON.stringify(saved))
    }
    setNotifications((prev) => prev.filter((n) => n.id !== noticeId))
  }

  useEffect(() => {
    authAPI.getUsers()
      .then(({ data }) => setAllUsers(data))
      .catch((err) => console.error('회원 목록 불러오기 실패:', err))
      .finally(() => setLoadingUsers(false))
  }, [])

  // ⭐️ 리뷰 데이터 가져오기
  const fetchReviews = async () => {
    if (!user) return
    setLoadingReviews(true)
    try {
      const res = await reviewAPI.getMyReviews()
      setReviewsData(res.data || { given: [], received: [] })
    } catch (err) {
      console.error('리뷰 불러오기 실패:', err)
    } finally {
      setLoadingReviews(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchReviews()
    }
  }, [user, bottomTab])

  const checkMatchesAndUnread = async () => {
    try {
      const { data } = await matchingAPI.getMyMatches()
      const matches = data || []
      setMyMatches(matches)

      const lastSeenStr = localStorage.getItem('last_seen_chat_time')
      const lastSeenTime = lastSeenStr ? new Date(lastSeenStr).getTime() : 0

      let totalUnread = 0
      matches.forEach((m) => {
        if (m.last_message_time && m.last_sender_id && String(m.last_sender_id) !== String(user?.id)) {
          const msgTime = new Date(m.last_message_time).getTime()
          if (msgTime > lastSeenTime) {
            totalUnread += 1
          }
        }
      })

      if (bottomTab === 'chat') {
        setUnreadCount(0)
        localStorage.setItem('last_seen_chat_time', new Date().toISOString())
      } else {
        setUnreadCount(totalUnread)
      }
    } catch (err) {
      console.error('채팅목록 및 새 메시지 조회 실패:', err)
    } finally {
      setLoadingMatches(false)
    }
  }

  useEffect(() => {
    if (!user) return
    checkMatchesAndUnread()

    const interval = setInterval(checkMatchesAndUnread, 3000)
    return () => clearInterval(interval)
  }, [user, bottomTab])

  const handleSelectTab = (tabName) => {
    setBottomTab(tabName)
    setSearchParams({ tab: tabName })
    if (tabName === 'chat') {
      setUnreadCount(0)
      localStorage.setItem('last_seen_chat_time', new Date().toISOString())
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleGoAptitude = () => {
    if (isFarmer) {
      alert('농부 회원은 적성검사 대상이 아닙니다.')
      return
    }
    setActiveHeaderTab(null)
    navigate('/aptitude')
  }

  const handleAutoMatching = () => {
    if (!isFarmer && isStatsEmpty(user)) {
      alert('먼저 적성검사를 완료해주세요! 적성검사 페이지로 이동합니다.')
      navigate('/aptitude')
      return
    }
    navigate('/matching')
  }

  const toggleHeaderTab = (tabName) => {
    const nextTab = activeHeaderTab === tabName ? null : tabName
    setActiveHeaderTab(nextTab)

    if (tabName === 'notice' && user) {
      setNoticeBadgeCount(0)
      localStorage.setItem(`seen_notice_count_${user.id}`, String(notifications.length))
    }
  }

  const activeReviews = reviewTabSub === 'received' ? reviewsData.received : reviewsData.given

  // 관리자 회원 분류
  const farmerUsers = allUsers.filter((u) => u.role === '농부')
  const youthUsers = allUsers.filter((u) => u.role === '청년' || u.role !== '농부')

  const filteredAdminUsers =
    adminUserRoleFilter === 'farmer'
      ? farmerUsers
      : adminUserRoleFilter === 'youth'
      ? youthUsers
      : allUsers

  return (
    <div className={styles.wrapper}>
      {/* 배경 */}
      <div className={styles.bgOrb} />

      {/* 상단 헤더 */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>🌱 소일거리</span>
          {user?.name && (
            <span className={styles.userLoginNotice}>
              {user.name} 님 로그인 중
            </span>
          )}
        </div>
        <div className={styles.headerRight}>
          <button
            className={`${styles.topBtn} ${activeHeaderTab === 'notice' ? styles.topBtnActive : ''} ${styles.topBtnBadgeWrapper}`}
            onClick={() => toggleHeaderTab('notice')}
          >
            🔔 알림
            {noticeBadgeCount > 0 && (
              <span className={styles.topBtnBadge}>{noticeBadgeCount}</span>
            )}
          </button>
          <button
            className={`${styles.topBtn} ${activeHeaderTab === 'menu' ? styles.topBtnActive : ''}`}
            onClick={() => toggleHeaderTab('menu')}
          >
            🔗 메뉴
          </button>
          <button
            className={`${styles.topBtn} ${activeHeaderTab === 'settings' ? styles.topBtnActive : ''}`}
            onClick={() => toggleHeaderTab('settings')}
          >
            ⚙️ 설정
          </button>
        </div>
      </header>

      {/* 단일 카드로 정돈된 스크롤 패널 */}
      {activeHeaderTab && (
        <div className={styles.menuScrollSection}>
          {/* 1. 🔔 알림 탭 클릭 시 */}
          {activeHeaderTab === 'notice' && (
            <div className={`glass-card ${styles.menuCard}`}>
              <div className={styles.menuCardHeader}>
                <h4>🔔 알림 센터 ({notifications.length})</h4>
                <button className={styles.panelCloseBtn} onClick={() => setActiveHeaderTab(null)}>접기 ▲</button>
              </div>
              <div className={styles.menuCardBody}>
                {notifications.length === 0 ? (
                  <p className={styles.emptyText}>새로운 알림이 없습니다. 🌾</p>
                ) : (
                  <div className={styles.noticeListGroup}>
                    {notifications.map((n) => (
                      <div key={n.id} className={styles.welcomeNoticeBox}>
                        {n.canDismiss && (
                          <button
                            className={styles.noticeDismissBtn}
                            onClick={() => handleDismissNotice(n.id)}
                            title="알림 삭제"
                          >
                            ✕
                          </button>
                        )}
                        <div className={styles.welcomeNoticeHeader}>
                          <span className={styles.welcomeNoticeIcon}>
                            {n.type === 'review' ? '⭐' : n.type === 'match' ? '💬' : '🌱'}
                          </span>
                          <div style={{ flex: 1, paddingRight: n.canDismiss ? '20px' : '0' }}>
                            <strong>{n.title}</strong>
                            <p>{n.desc}</p>
                          </div>
                        </div>
                        {n.btnText && (
                          <button
                            className={`btn btn-primary ${styles.welcomeNoticeBtn}`}
                            onClick={n.action}
                          >
                            {n.btnText}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. 🔗 메뉴 탭 클릭 시 */}
          {activeHeaderTab === 'menu' && (
            <div className={`glass-card ${styles.menuCard}`}>
              <div className={styles.menuCardHeader}>
                <h4>🛠️ 관리자 기능</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={styles.userCountBadge}>총 {allUsers.length}명</span>
                  <button className={styles.panelCloseBtn} onClick={() => setActiveHeaderTab(null)}>접기 ▲</button>
                </div>
              </div>
              <div className={styles.accountActionBody}>
                <button
                  className={`btn btn-outline ${styles.settingItemBtn}`}
                  onClick={handleGoAptitude}
                >
                  🌱 적성검사 하러가기 (관리자/테스트)
                </button>
              </div>

              {/* 👥 전체 회원 현황 (농부 진하게 / 청년 짙게 시각적 대비) */}
              <div className={styles.menuCardBody} style={{ borderTop: '1px dashed #EDE8D5' }}>
                <div className={styles.adminFilterHeader}>
                  <h5 style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--color-brown)', margin: 0 }}>
                    👥 회원 현황 목록
                  </h5>
                  <div className={styles.adminRoleChipGroup}>
                    <button
                      type="button"
                      className={`${styles.adminRoleChip} ${adminUserRoleFilter === 'all' ? styles.adminRoleChipActive : ''}`}
                      onClick={() => setAdminUserRoleFilter('all')}
                    >
                      전체 ({allUsers.length})
                    </button>
                    <button
                      type="button"
                      className={`${styles.adminRoleChip} ${adminUserRoleFilter === 'farmer' ? styles.adminRoleChipActive : ''}`}
                      onClick={() => setAdminUserRoleFilter('farmer')}
                    >
                      👨‍🌾 농부 ({farmerUsers.length})
                    </button>
                    <button
                      type="button"
                      className={`${styles.adminRoleChip} ${adminUserRoleFilter === 'youth' ? styles.adminRoleChipActive : ''}`}
                      onClick={() => setAdminUserRoleFilter('youth')}
                    >
                      🧑‍🌾 청년 ({youthUsers.length})
                    </button>
                  </div>
                </div>

                {loadingUsers ? (
                  <p className={styles.emptyText}>회원 목록을 불러오는 중...</p>
                ) : filteredAdminUsers.length === 0 ? (
                  <p className={styles.emptyText}>해당하는 회원이 없습니다.</p>
                ) : (
                  <div className={styles.userTable}>
                    {filteredAdminUsers.map((u) => (
                      <div
                        key={u.id}
                        className={`${styles.userRow} ${u.role === '농부' ? styles.farmerUserRow : styles.youthUserRow}`}
                      >
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
                            
                            {u.role !== '농부' && (
                              <div className={styles.statBadges}>
                                <span>💪근력:{u.strength ?? 0}</span>
                                <span>⚡체력:{u.stamina ?? 0}</span>
                                <span>🔥근성:{u.grit ?? 0}</span>
                                <span>🧠지성:{u.intelligence ?? 0}</span>
                              </div>
                            )}
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
            </div>
          )}

          {/* 3. ⚙️ 설정 탭 클릭 시 */}
          {activeHeaderTab === 'settings' && (
            <div className={`glass-card ${styles.menuCard}`}>
              <div className={styles.menuCardHeader}>
                <h4>⚙️ 설정 및 계정 관리</h4>
                <button className={styles.panelCloseBtn} onClick={() => setActiveHeaderTab(null)}>접기 ▲</button>
              </div>
              <div className={styles.accountActionBody}>
                <button
                  className={`btn btn-outline ${styles.settingItemBtn}`}
                  onClick={() => {
                    setActiveHeaderTab(null);
                    handleSelectTab('profile');
                  }}
                >
                  👤 내 정보 보기
                </button>
                <button
                  className={styles.logoutFullBtn}
                  onClick={handleLogout}
                >
                  🚪 로그아웃
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* 메인 콘텐츠 영역 */}
      <main className={`${styles.main} ${activeHeaderTab ? styles.mainDimmed : ''}`}>

        {/* 1️⃣ [⭐ 리뷰 관리 탭] 컨텐츠 */}
        {bottomTab === 'review' && (
          <div className={styles.tabContentFade}>
            {/* 🔝 맨 위: 깔끔하게 정돈된 평점 요약 카드 */}
            <section className={`glass-card ${styles.reviewSummaryHeaderCard}`}>
              <div className={styles.reviewSummaryHeaderLeft}>
                <span className={styles.reviewSummaryStarIcon}>⭐</span>
                <div className={styles.reviewSummaryScoreBox}>
                  <div className={styles.reviewSummaryScoreRow}>
                    <span className={styles.reviewSummaryBigNum}>
                      {user?.rating ? Number(user.rating).toFixed(1) : '0.0'}
                    </span>
                    <span className={styles.reviewSummaryMaxNum}>/ 5.0</span>
                  </div>
                  <span className={styles.reviewSummarySubText}>
                    받은 리뷰 총 <strong>{reviewsData.received.length}</strong>개
                  </span>
                </div>
              </div>
            </section>

            {/* 📋 서브 탭 & 개별 리뷰 목록 섹션 */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>📋 상세 리뷰 목록</h3>
                <div className={styles.reviewSubTabGroup}>
                  <button
                    className={`${styles.reviewSubChip} ${reviewTabSub === 'received' ? styles.reviewSubChipActive : ''}`}
                    onClick={() => setReviewTabSub('received')}
                  >
                    받은 리뷰 ({reviewsData.received.length})
                  </button>
                  <button
                    className={`${styles.reviewSubChip} ${reviewTabSub === 'given' ? styles.reviewSubChipActive : ''}`}
                    onClick={() => setReviewTabSub('given')}
                  >
                    내가 작성한 리뷰 ({reviewsData.given.length})
                  </button>
                </div>
              </div>

              {loadingReviews ? (
                <p className={styles.emptyText}>리뷰 데이터를 불러오는 중...</p>
              ) : activeReviews.length === 0 ? (
                <div className={`glass-card ${styles.emptyCtaBox}`}>
                  <span className={styles.emptyCtaIcon}>⭐</span>
                  <strong className={styles.emptyCtaTitle}>
                    {reviewTabSub === 'received' ? '아직 받은 리뷰가 없습니다' : '아직 작성한 리뷰가 없습니다'}
                  </strong>
                  <p className={styles.emptyCtaSub}>
                    일손 매칭 대화 종료 시 따뜻한 별점과 후기를 주고받아 보세요!
                  </p>
                </div>
              ) : (
                <div className={styles.reviewCardList}>
                  {activeReviews.map((rev) => (
                    <div key={rev.id} className={styles.reviewItemCard}>
                      <div className={styles.reviewItemHeader}>
                        <div className={styles.reviewUserMeta}>
                          <span className={styles.reviewUserAvatar}>
                            {reviewTabSub === 'received' ? '🧑‍🌾' : '👨‍🌾'}
                          </span>
                          <div>
                            <strong>
                              {reviewTabSub === 'received'
                                ? `${rev.reviewer_name} 님이 남긴 평가`
                                : `${rev.reviewee_name} 님에게 남긴 평가`}
                            </strong>
                            <span className={styles.reviewDate}>
                              {rev.created_at ? new Date(rev.created_at).toLocaleDateString('ko-KR') : ''}
                            </span>
                          </div>
                        </div>
                        <span className={styles.reviewStarBadge}>
                          ⭐ {Number(rev.rating).toFixed(1)}점
                        </span>
                      </div>
                      <div className={styles.reviewCommentBox}>
                        <p className={styles.reviewCommentBody}>
                          "{rev.comment || '따뜻한 후기를 남겼습니다.'}"
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* 2️⃣ [👤 내 정보 탭] 컨텐츠 */}
        {bottomTab === 'profile' && (
          <div className={styles.tabContentFade}>
            {/* 메인 유저 아바타 카드 */}
            <section className={`glass-card ${styles.userMainCard}`}>
              <div className={styles.avatarArea}>
                <span className={styles.avatarEmoji}>
                  {isFarmer ? '👨‍🌾' : '🧑‍🌾'}
                </span>
              </div>
              <h2 className={styles.userName}>{user?.name}</h2>
              <span className={styles.userRoleTag}>{user?.role}</span>
              <div className={styles.ratingBox}>
                <span>⭐ 평균 평점</span>
                <strong>{user?.rating ? Number(user?.rating).toFixed(1) : '0.0'} / 5.0</strong>
              </div>
            </section>

            {/* 📊 내 매칭 스탯 그리드 (농부 회원 제외) */}
            {!isFarmer && (
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
            )}

            {/* 📋 기본 계정 정보 카드 + 내 정보 수정 */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>📋 기본 계정 정보</h3>
              <div className={`glass-card ${styles.profileCard}`}>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>이름</span>
                  <strong className={styles.profileValText}>{user?.name}</strong>
                </div>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>이메일</span>
                  <span>{user?.email}</span>
                </div>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>회원 유형</span>
                  <span className={styles.roleTag}>{user?.role}</span>
                </div>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>거주 지역</span>
                  <span>{user?.location || '미설정'}</span>
                </div>
                <div className={styles.profileRow}>
                  <span className={styles.profileLabel}>AI 매칭 상태</span>
                  <span className={user?.is_seeking !== false ? styles.seekingTagActive : styles.seekingTagPaused}>
                    {user?.is_seeking !== false ? '🟢 AI 매칭 활성화' : '⚪ AI 매칭 일시정지'}
                  </span>
                </div>

                <div className={styles.spacerRow} />

                <button
                  className={`btn btn-outline ${styles.editProfileBtn}`}
                  onClick={handleOpenEditProfile}
                >
                  ✏️ 내 정보 수정
                </button>
              </div>
            </section>
          </div>
        )}

        {/* 3️⃣ [⚡ 찾기 탭] 컨텐츠 */}
        {bottomTab === 'matching' && (
          <div className={styles.tabContentFade}>
            {/* ⚡ 중앙 커다란 AI 자동매칭 히어로 카드 & 대형 버튼 */}
            <section className={styles.aiMatchingHeroSection}>
              <div className={`glass-card ${styles.aiMatchingHeroCard}`}>
                <div className={styles.aiMatchingHeroHeader}>
                  <span className={styles.aiMatchingHeroBadge}>ML 기반 AI 추천 시스템</span>
                  <div className={styles.aiMatchingHeroIconArea}>
                    <span className={styles.aiMatchingHeroIcon}>🤖</span>
                  </div>
                  <h3 className={styles.aiMatchingHeroTitle}>
                    {isFarmer ? '⚡ 최적의 청년 일손 찾기' : '⚡ 나에게 딱 맞는 농부(일자리) 찾기'}
                  </h3>
                  <p className={styles.aiMatchingHeroSub}>
                    {isFarmer ? (
                      <>AI가 농가의 거주 지역과 조건에 맞는<br />최적의 청년 일손을 매칭해 드립니다</>
                    ) : (
                      <>AI가 내 유형검사 결과와 거주 지역을 분석하여<br />최적의 농가 일자리를 매칭해 드립니다</>
                    )}
                  </p>
                </div>

                <button
                  className={`btn ${styles.aiMatchingHeroBtn}`}
                  onClick={handleAutoMatching}
                >
                  {isFarmer ? '⚡ AI 청년 자동매칭 시작하기 ⚡' : '⚡ AI 농부 자동매칭 시작하기 ⚡'}
                </button>
              </div>
            </section>
          </div>
        )}

        {/* 4️⃣ [💬 채팅방 탭] 컨텐츠 */}
        {bottomTab === 'chat' && (
          <div className={styles.tabContentFade}>
            {/* 💬 채팅방 목록 */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>💬 채팅방 목록</h3>
                {myMatches.length > 0 && (
                  <span className={styles.userCountBadge}>{myMatches.length}개</span>
                )}
              </div>

              <div className={`glass-card ${styles.chatListCard}`}>
                {loadingMatches ? (
                  <p className={styles.emptyText}>채팅방을 불러오는 중...</p>
                ) : myMatches.length === 0 ? (
                  <div className={styles.emptyCtaBox}>
                    <span className={styles.emptyCtaIcon}>🌾</span>
                    <strong className={styles.emptyCtaTitle}>아직 연결된 대화방이 없어요</strong>
                    <p className={styles.emptyCtaSub}>
                      {isFarmer
                        ? 'AI 청년 찾기로 나에게 딱 맞는 청년 일손과 대화를 시작해 보세요!'
                        : 'AI 농부 찾기로 나에게 딱 맞는 농가 일자리와 대화를 시작해 보세요!'}
                    </p>
                    <button
                      className={`btn btn-primary ${styles.emptyCtaBtn}`}
                      onClick={handleAutoMatching}
                    >
                      {isFarmer ? '⚡ AI 청년 매칭 받아보기' : '⚡ AI 농부 매칭 받아보기'}
                    </button>
                  </div>
                ) : (
                  myMatches.map((m) => (
                    <div
                      key={m.match_id}
                      className={styles.chatListItem}
                      onClick={() => {
                        handleSelectTab('chat')
                        navigate(`/chat/${m.match_id}`)
                      }}
                    >
                      <span className={styles.chatPartnerAvatar}>
                        {m.partner_role === '농부' ? '👨‍🌾' : '🧑‍🌾'}
                      </span>
                      <div className={styles.chatListItemBody}>
                        <div className={styles.chatListItemTitleRow}>
                          <strong className={styles.chatPartnerName}>
                            {m.partner_name || '상대방'}
                          </strong>
                          <span className={`${styles.roleBadge} ${m.partner_role === '농부' ? styles.farmerBadge : styles.youthBadge}`}>
                            {m.partner_role || '회원'}
                          </span>
                        </div>
                        <p className={styles.chatListItemDesc}>
                          {m.task ? `업무: ${m.task}` : '채팅방'}
                          {m.partner_left && (
                            <span className={styles.partnerLeftTag}> · 상대방이 채팅을 나갔습니다</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

      </main>

      {/* 📱 5대 필수 하단 고정 탭 바 */}
      <nav className={styles.bottomNav}>
        <button
          className={`${styles.bottomNavItem} ${bottomTab === 'review' ? styles.bottomNavActive : ''}`}
          onClick={() => handleSelectTab('review')}
        >
          <span className={styles.bottomNavIcon}>⭐</span>
          <span className={styles.bottomNavLabel}>리뷰 관리</span>
        </button>

        <button
          className={`${styles.bottomNavItem} ${bottomTab === 'profile' ? styles.bottomNavActive : ''}`}
          onClick={() => handleSelectTab('profile')}
        >
          <span className={styles.bottomNavIcon}>👤</span>
          <span className={styles.bottomNavLabel}>내정보</span>
        </button>

        <button
          className={`${styles.bottomNavItem} ${bottomTab === 'matching' ? styles.bottomNavActive : ''}`}
          onClick={() => handleSelectTab('matching')}
        >
          <span className={styles.bottomNavIcon}>⚡</span>
          <span className={styles.bottomNavLabel}>{isFarmer ? '청년 찾기' : '농부 찾기'}</span>
        </button>

        <button
          className={`${styles.bottomNavItem} ${bottomTab === 'chat' ? styles.bottomNavActive : ''}`}
          onClick={() => handleSelectTab('chat')}
        >
          <span className={styles.bottomNavIcon}>💬</span>
          <span className={styles.bottomNavLabel}>채팅방</span>
          {unreadCount > 0 && <span className={styles.bottomNavBadge}>{unreadCount}</span>}
        </button>

        <button
          className={styles.bottomNavItem}
          onClick={() => navigate('/support')}
        >
          <span className={styles.bottomNavIcon}>🤖</span>
          <span className={styles.bottomNavLabel}>AI상담사</span>
        </button>
      </nav>

      {/* ✏️ 내 정보 수정 팝업 모달 */}
      {isEditProfileOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsEditProfileOpen(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>✏️ 내 정보 수정</h3>
              <button
                className={styles.modalCloseBtn}
                onClick={() => setIsEditProfileOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitEditProfile} className={styles.modalForm}>
              {/* 1. 이름 (닉네임) */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>이름 (닉네임)</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="이름을 입력하세요"
                  required
                />
              </div>

              {/* 2. 거주 지역 (텍스트 입력) */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>거주 지역</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={editFormData.location}
                  onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                  placeholder="예: 충북 청주시, 경기도 수원시 등"
                />
              </div>

              {/* 3. AI 매칭 상태 토글 */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  AI 매칭 상태
                </label>
                <div className={styles.toggleRow}>
                  <span className={styles.toggleDesc}>
                    {editFormData.is_seeking
                      ? '🟢 현재 AI 매칭 추천 받아보기 (활성화)'
                      : '⚪ AI 매칭 일시정지 (추천 대상 제외)'}
                  </span>
                  <input
                    type="checkbox"
                    className={styles.toggleCheckbox}
                    checked={editFormData.is_seeking}
                    onChange={(e) => setEditFormData({ ...editFormData, is_seeking: e.target.checked })}
                  />
                </div>
              </div>

              <div className={styles.modalActionGroup}>
                <button
                  type="button"
                  className={`btn btn-outline ${styles.modalCancelBtn}`}
                  onClick={() => setIsEditProfileOpen(false)}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className={`btn btn-primary ${styles.modalSubmitBtn}`}
                  disabled={submittingEdit}
                >
                  {submittingEdit ? '저장 중...' : '✏️ 수정하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
