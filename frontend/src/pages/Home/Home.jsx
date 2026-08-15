import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../store/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authAPI, matchingAPI, reviewAPI } from '../../api'
import { useToast } from '../../context/ToastContext'
import StatHexagon from '../../components/StatHexagon'
import styles from './Home.module.css'

// [피드백 반영] 농업 특화 스텟 라벨 (컬럼명은 기존 그대로 유지, 표시 이름만 구체화)
const STAT_DISPLAY = [
  { field: 'stamina', label: '체력', icon: '⚡' },
  { field: 'strength', label: '근력', icon: '💪' },
  { field: 'intelligence', label: '숙련도', icon: '🧠' },
  { field: 'grit', label: '성실성', icon: '🔥' },
  { field: 'personality', label: '협동심', icon: '🤝' },
  { field: 'wage_pref', label: '급여민감도', icon: '💰' },
]

const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// 🏆 레벨(Lv.1 ~ Lv.10) 및 경험치(EXP) 유틸리티
export const LEVEL_TABLE = [
  { level: 1, minExp: 0, maxExp: 100, youthTitle: '새싹 소일꾼', farmerTitle: '초보 농부' },
  { level: 2, minExp: 100, maxExp: 250, youthTitle: '초보 소일꾼', farmerTitle: '새싹 농부' },
  { level: 3, minExp: 250, maxExp: 450, youthTitle: '숙련 소일꾼', farmerTitle: '경험자 농부' },
  { level: 4, minExp: 450, maxExp: 700, youthTitle: '베테랑 소일꾼', farmerTitle: '베테랑 농부' },
  { level: 5, minExp: 700, maxExp: 1000, youthTitle: '농가의 희망', farmerTitle: '농사의 달인' },
  { level: 6, minExp: 1000, maxExp: 1350, youthTitle: '전문 소일꾼', farmerTitle: '명품 대농' },
  { level: 7, minExp: 1350, maxExp: 1750, youthTitle: '마스터 소일꾼', farmerTitle: '리더 농부' },
  { level: 8, minExp: 1750, maxExp: 2200, youthTitle: '전설의 일손', farmerTitle: '으뜸 대농' },
  { level: 9, minExp: 2200, maxExp: 2700, youthTitle: '소일거리 장인', farmerTitle: '농가의 수호자' },
  { level: 10, minExp: 2700, maxExp: 2700, youthTitle: '농사의 신 👑', farmerTitle: '대한민국 으뜸농부 👑' },
]

export function getLevelDetail(exp = 0, role = '청년') {
  const currentExp = Math.max(0, exp)
  let info = LEVEL_TABLE.find((t) => currentExp >= t.minExp && (t.level === 10 || currentExp < t.maxExp))
  if (!info) {
    info = LEVEL_TABLE[LEVEL_TABLE.length - 1]
  }

  const isMax = info.level === 10
  const title = role === '농부' ? info.farmerTitle : info.youthTitle
  const min = info.minExp
  const max = isMax ? min : info.maxExp
  const needed = isMax ? 0 : max - min
  const currentInLevel = isMax ? 0 : currentExp - min
  const progressPercent = isMax ? 100 : Math.min(100, Math.round((currentInLevel / needed) * 100))

  return {
    level: info.level,
    title,
    currentExp,
    minExp: min,
    maxExp: max,
    currentInLevel,
    neededInLevel: needed,
    progressPercent,
    isMax,
  }
}

export function getHarvestIndexInfo(user, receivedReviews = [], myMatches = []) {
  const rating = user?.rating ? Number(user.rating) : 0.0
  const totalMatches = myMatches.length
  const canceledMatches = myMatches.filter((m) => m.partner_left).length
  const successMatches = Math.max(0, totalMatches - canceledMatches)

  const successRate = totalMatches > 0 ? Math.round((successMatches / totalMatches) * 100) : 100

  const receivedCount = receivedReviews.length
  const positiveCount = receivedReviews.filter((r) => Number(r.rating) >= 4.0).length
  const satisfactionRate = receivedCount > 0 ? Math.round((positiveCount / receivedCount) * 100) : 100

  let index = 50
  if (receivedCount > 0 || totalMatches > 0) {
    index = Math.min(100, Math.max(0, Math.round((rating / 5.0) * 80 + (successRate / 100) * 20)))
  }

  let grade = '🌱 새싹 경작자'
  if (index >= 90) {
    grade = '👑 풍년 농사의 신'
  } else if (index >= 70) {
    grade = '🌾 풍요로운 결실'
  } else if (index >= 50) {
    grade = '🌿 잘 자라는 일손'
  }

  return {
    harvestIndex: index,
    grade,
    totalMatches,
    successMatches,
    canceledMatches,
    successRate,
    receivedCount,
    positiveCount,
    satisfactionRate,
  }
}

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
    province: '충청북도',
    city: '',
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

  // 🌾 [피드백 반영] 내 정보 탭 - AI 추천 업무 (직업 배지 바로 옆에 표시)
  // task/message/ai_reason 을 함께 보관해, 배지 클릭 시 AI 분석 상세보기 팝업에 사용한다.
  const [recommendedTask, setRecommendedTask] = useState(null)
  const [showTaskAnalysisModal, setShowTaskAnalysisModal] = useState(false)

  // 🖼️ [피드백 반영] 내 정보 탭 - 프로필 사진 업로드
  const photoInputRef = useRef(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

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
    const rawLoc = (user.location || '').trim()
    let prov = '충청북도'
    let cty = ''
    if (rawLoc) {
      const parts = rawLoc.split(' ')
      if (parts.length >= 2) {
        prov = parts[0]
        cty = parts.slice(1).join(' ')
      } else {
        cty = rawLoc
      }
    }
    setEditFormData({
      name: user.name || '',
      province: prov,
      city: cty,
      is_seeking: user.is_seeking !== false,
    })
    setIsEditProfileOpen(true)
  }

  const { showToast } = useToast()

  // ✏️ 내 정보 수정 저장 처리
  const handleSubmitEditProfile = async (e) => {
    e.preventDefault()
    if (!editFormData.name.trim()) {
      showToast('이름을 입력해주세요.', 'error')
      return
    }
    if (!editFormData.province || !editFormData.city.trim()) {
      showToast('거주 지역(도/시)을 필수 항목으로 입력해 주세요.', 'error')
      return
    }

    setSubmittingEdit(true)
    try {
      const fullLocation = `${editFormData.province} ${editFormData.city.trim()}`
      await authAPI.updateMe({
        name: editFormData.name.trim(),
        location: fullLocation,
        is_seeking: editFormData.is_seeking,
      })

      await refreshUser()
      setIsEditProfileOpen(false)
      showToast('내 정보가 성공적으로 수정되었습니다! 🎉', 'success')
    } catch (err) {
      console.error('내 정보 수정 실패:', err)
      showToast(err.response?.data?.detail || '내 정보 수정 중 오류가 발생했습니다.', 'error')
    } finally {
      setSubmittingEdit(false)
    }
  }

  // 🌾 [피드백 반영] 청년 회원의 "적성검사 결과 기반 추천 업무"를 조회해
  // 내 정보 탭의 직업(청년) 배지 바로 옆에 표시한다.
  useEffect(() => {
    if (!user || isFarmer || isStatsEmpty(user)) {
      setRecommendedTask(null)
      return
    }
    matchingAPI.getRecommendedTasks(1)
      .then((res) => setRecommendedTask(res.data?.[0] || null))
      .catch((err) => {
        console.error('추천 업무 조회 실패:', err)
        setRecommendedTask(null)
      })
  }, [user?.id, user?.strength, user?.stamina, user?.grit, user?.intelligence, user?.wage_pref, user?.personality, isFarmer])

  // 🖼️ [피드백 반영] 프로필 사진 업로드 (2~5MB 이하)
  const handleClickAvatar = () => {
    if (uploadingPhoto) return
    photoInputRef.current?.click()
  }

  const handlePhotoSelected = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!ALLOWED_PROFILE_IMAGE_TYPES.includes(file.type)) {
      showToast('JPEG, PNG, WEBP 형식의 이미지만 등록할 수 있어요.', 'error')
      return
    }
    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      showToast('프로필 사진은 5MB를 넘을 수 없어요.', 'error')
      return
    }

    setUploadingPhoto(true)
    try {
      await authAPI.uploadProfileImage(file)
      await refreshUser()
      showToast('프로필 사진이 등록되었습니다! 🖼️', 'success')
    } catch (err) {
      showToast('프로필 사진 업로드 실패: ' + (err.response?.data?.detail || '오류가 발생했습니다.'), 'error')
    } finally {
      setUploadingPhoto(false)
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

    // 4. 🏆 [신규 기능] 레벨업 달성 축하 알림 (Lv.2 이상 도달 시)
    const levelInfo = getLevelDetail(user.exp || 0, user.role || '청년')
    if (levelInfo.level > 1) {
      const levelNoticeId = `level_up_${levelInfo.level}`
      if (!savedDismissed.includes(levelNoticeId)) {
        list.push({
          id: levelNoticeId,
          type: 'level',
          canDismiss: true,
          title: `🎉 레벨업 축하합니다! Lv.${levelInfo.level} 달성!`,
          desc: `축하합니다! 소일거리 활동으로 경험치를 쌓아 [${levelInfo.title}] 칭호를 획득하셨습니다! 🏆🌾`,
          btnText: '👤 내 정보 프로필 보기',
          action: () => {
            setActiveHeaderTab(null)
            setBottomTab('profile')
            setSearchParams({ tab: 'profile' })
            showToast(`🎉 Lv.${levelInfo.level} [${levelInfo.title}] 달성을 축하드립니다!`, 'success')
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
      showToast('농부 회원은 적성검사 대상이 아닙니다.', 'info')
      return
    }
    setActiveHeaderTab(null)
    navigate('/aptitude')
  }

  // 💡 적성검사 안내 모달 제어 상태
  const [showAptitudeNoticeModal, setShowAptitudeNoticeModal] = useState(false)

  // ⚡ 메인 매칭 탭에서 바로 매칭 상태 (ON/OFF) 토글
  const [togglingSeeking, setTogglingSeeking] = useState(false)

  const handleToggleSeeking = async () => {
    if (!user || togglingSeeking) return
    const nextStatus = user.is_seeking === false

    // [피드백 반영] 적성검사를 아직 하지 않은(스텟 전부 0) 청년이 이 버튼으로
    // 바로 매칭을 켜지 못하도록, 먼저 적성검사 안내 모달을 띄운다.
    if (nextStatus && !isFarmer && isStatsEmpty(user)) {
      setShowAptitudeNoticeModal(true)
      return
    }

    setTogglingSeeking(true)
    try {
      await authAPI.updateMe({ is_seeking: nextStatus })
      await refreshUser()
      showToast(
        nextStatus
          ? '🟢 소일거리 매칭이 활성화되었습니다!'
          : '⚪ 소일거리 매칭이 일시정지되었습니다.',
        nextStatus ? 'success' : 'info'
      )
    } catch (err) {
      console.error('매칭 상태 변경 실패:', err)
      showToast(err.response?.data?.detail || '매칭 상태 변경 중 오류가 발생했습니다.', 'error')
    } finally {
      setSubmittingEdit(false)
      setTogglingSeeking(false)
    }
  }

  const handleAutoMatching = () => {
    if (!isFarmer && isStatsEmpty(user)) {
      setShowAptitudeNoticeModal(true)
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
                            {n.type === 'level' ? '🏆' : n.type === 'review' ? '⭐' : n.type === 'match' ? '💬' : '🌱'}
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

          {/* ⚙️ 설정 탭 클릭 시 */}
          {activeHeaderTab === 'settings' && (
            <div className={`glass-card ${styles.menuCard}`}>
              <div className={styles.menuCardHeader}>
                <h4>⚙️ 설정 및 메뉴</h4>
                <button className={styles.panelCloseBtn} onClick={() => setActiveHeaderTab(null)}>접기 ▲</button>
              </div>
              <div className={styles.accountActionBody}>
                {/* [피드백 반영] 농부는 적성검사 대상이 아니므로 버튼 자체를 노출하지 않음 */}
                {!isFarmer && (
                  <button
                    className={`btn btn-outline ${styles.settingItemBtn}`}
                    onClick={() => {
                      setActiveHeaderTab(null);
                      handleGoAptitude();
                    }}
                  >
                    🌱 적성검사 다시받기
                  </button>
                )}
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
                    받은 리뷰 총 <strong>{reviewsData.received.length}</strong>개 · 내가 쓴 리뷰 <strong>{reviewsData.given.length}</strong>개
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
                    내가 쓴 리뷰 ({reviewsData.given.length})
                  </button>
                </div>
              </div>

              {loadingReviews ? (
                <p className={styles.emptyText}>리뷰 데이터를 불러오는 중...</p>
              ) : activeReviews.length === 0 ? (
                <div className={`glass-card ${styles.emptyCtaBox}`}>
                  <span className={styles.emptyCtaIcon}>⭐</span>
                  <strong className={styles.emptyCtaTitle}>
                    {reviewTabSub === 'received' ? '아직 받은 후기가 없습니다' : '아직 작성한 후기가 없습니다'}
                  </strong>
                  <p className={styles.emptyCtaSub}>
                    일손 매칭 후 서로 따뜻한 평가와 소중한 후기를 나눠보세요!
                  </p>
                </div>
              ) : (
                <div className={styles.reviewCardList}>
                  {activeReviews.map((rev) => (
                    <div key={rev.id} className={styles.reviewItemCard}>
                      <div className={styles.reviewItemHeader}>
                        <div className={styles.reviewUserMeta}>
                          <span className={styles.reviewUserAvatar}>
                            {reviewTabSub === 'received' ? (isFarmer ? '🌱' : '👨‍🌾') : (isFarmer ? '👨‍🌾' : '🌱')}
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
            {/* 메인 유저 아바타 카드 (통합 카드 - 청년: 화이트 / 농부: 옐로우 구분) */}
            <section className={`glass-card ${styles.userMainCard} ${isFarmer ? styles.farmerUserMainCard : styles.youthUserMainCard}`}>
              {/* 🖼️ 프로필 사진 */}
              <div
                className={`${styles.avatarArea} ${isFarmer ? styles.farmerAvatarRing : styles.youthAvatarRing}`}
                onClick={handleClickAvatar}
                role="button"
                title="프로필 사진 등록/변경"
              >
                <img
                  src={user?.profile_image || (isFarmer ? '/images/farmer.png' : '/images/chung.png')}
                  alt="프로필 사진"
                  className={styles.avatarImg}
                />
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handlePhotoSelected}
              />

              <h2 className={styles.userName}>{user?.name}</h2>
              <div className={styles.roleTaskRow}>
                <span className={`${styles.userRoleTag} ${isFarmer ? styles.farmerRoleTag : styles.youthRoleTag}`}>{user?.role}</span>
                {!isFarmer && (
                  recommendedTask ? (
                    <button
                      type="button"
                      className={styles.recommendedTaskTag}
                      onClick={() => setShowTaskAnalysisModal(true)}
                      title="AI 분석 상세하게 보기"
                    >
                      ✨ 추천업무: {recommendedTask.task} 🔍
                    </button>
                  ) : (
                    <span className={styles.recommendedTaskTag}>적성검사 필요</span>
                  )
                )}
              </div>

              {/* 🏆 레벨 & 경험치(EXP) 게이지 바 */}
              {(() => {
                const levelInfo = getLevelDetail(user?.exp || 0, user?.role || '청년')
                return (
                  <div className={styles.levelCardSection}>
                    <div className={styles.levelBadgeRow}>
                      <span className={styles.levelBadge}>
                        🏆 Lv.{levelInfo.level}
                      </span>
                      <strong className={styles.levelTitleText}>
                        {levelInfo.title}
                      </strong>
                    </div>

                    <div className={styles.expProgressBarWrapper}>
                      <div className={styles.expProgressBarTrack}>
                        <div
                          className={styles.expProgressBarFill}
                          style={{ width: `${levelInfo.progressPercent}%` }}
                        />
                      </div>
                      <div className={styles.expProgressTextRow}>
                        <span className={styles.expSubLabel}>
                          {levelInfo.isMax ? '👑 최고 레벨 달성!' : `다음 레벨까지 +${levelInfo.maxExp - levelInfo.currentExp} EXP`}
                        </span>
                        <strong className={styles.expNumText}>
                          {levelInfo.currentExp} / {levelInfo.isMax ? 'MAX' : levelInfo.maxExp} EXP ({levelInfo.progressPercent}%)
                        </strong>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* 🌾 통합 소일거리 결실 리포트 (평균 평점, 받은 리뷰, 작성한 리뷰, 만족도, 매칭 성과 통일) */}
              {(() => {
                const harvestInfo = getHarvestIndexInfo(user, reviewsData.received, myMatches)
                const givenCount = reviewsData.given ? reviewsData.given.length : 0
                const receivedCount = reviewsData.received ? reviewsData.received.length : 0

                return (
                  <div className={styles.harvestInnerCard}>
                    {/* 1. 풍년 지수 헤더 */}
                    <div className={styles.harvestHeaderRow}>
                      <div className={styles.harvestTitleBox}>
                        <span className={styles.harvestSubLabel}>내 소일거리 활동 리포트</span>
                        <strong className={styles.harvestMainScore}>
                          🌾 풍년 지수 {harvestInfo.harvestIndex}%
                        </strong>
                      </div>
                      <span className={styles.harvestGradeBadge}>
                        {harvestInfo.grade}
                      </span>
                    </div>

                    {/* 2. 게이지 바 */}
                    <div className={styles.harvestProgressBarTrack}>
                      <div
                        className={styles.harvestProgressBarFill}
                        style={{ width: `${harvestInfo.harvestIndex}%` }}
                      />
                    </div>

                    <div className={styles.harvestDivider} />

                    {/* 3. ⭐ 내 정보 탭 맞춤 콤팩트 서브스텟 평점 요약 블록 */}
                    <div className={styles.profileSubStatCard}>
                      <div className={styles.profileSubStatLeft}>
                        <span className={styles.profileSubStatStarIcon}>⭐</span>
                        <div className={styles.profileSubStatScoreBox}>
                          <div className={styles.profileSubStatScoreRow}>
                            <span className={styles.profileSubStatBigNum}>
                              {user?.rating ? Number(user.rating).toFixed(1) : '0.0'}
                            </span>
                            <span className={styles.profileSubStatMaxNum}>/ 5.0</span>
                          </div>
                          <span className={styles.profileSubStatSubText}>
                            받은 리뷰 총 <strong>{receivedCount}</strong>개 · 내가 쓴 리뷰 <strong>{givenCount}</strong>개
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 5. ⭐ 일손 만족 추천율 */}
                    <div className={styles.harvestDetailBox}>
                      <div className={styles.harvestDetailRow}>
                        <span className={styles.harvestDetailLabel}>⭐ 일손 만족 추천율</span>
                        <strong className={styles.harvestDetailHighlight}>
                          {harvestInfo.receivedCount > 0 ? `${harvestInfo.satisfactionRate}%` : '아직 없음'}
                        </strong>
                      </div>
                      <p className={styles.harvestDetailSubText}>
                        {harvestInfo.receivedCount > 0
                          ? `받은 평가 ${harvestInfo.receivedCount}명 중 ${harvestInfo.positiveCount}명이 칭찬함`
                          : '아직 등록된 매칭 평가 후기가 없습니다'}
                      </p>
                    </div>

                    {/* 6. 🤝 매칭 진행 성과 */}
                    <div className={styles.harvestDetailBox}>
                      <div className={styles.harvestDetailRow}>
                        <span className={styles.harvestDetailLabel}>🤝 매칭 진행 성과</span>
                        <strong className={styles.harvestDetailHighlight}>
                          {harvestInfo.totalMatches > 0 ? `성공률 ${harvestInfo.successRate}%` : '아직 없음'}
                        </strong>
                      </div>
                      <p className={styles.harvestDetailSubText}>
                        {harvestInfo.totalMatches > 0 ? (
                          <>
                            총 <strong>{harvestInfo.totalMatches}회</strong> 개설 대화 중{' '}
                            <span className={styles.successTagText}>성공 {harvestInfo.successMatches}회</span> ·{' '}
                            <span className={styles.cancelTagText}>중단 {harvestInfo.canceledMatches}회</span>
                          </>
                        ) : (
                          '아직 진행된 소일거리 매칭 내역이 없습니다'
                        )}
                      </p>
                    </div>
                  </div>
                )
              })()}
            </section>

            {/* 📊 내 매칭 스탯 (농부 회원 제외) - 육각형 지표 + 숫자 지표를 함께 표시 */}
            {!isFarmer && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>📊 내 일손 역량 지표</h3>
                <div className={`glass-card ${styles.statsRow}`}>
                  {/* 🔷 [피드백 반영] 왼쪽: 육각형 지표 (스텟이 0이어도 작은 육각형이 보임) */}
                  <StatHexagon
                    items={STAT_DISPLAY.map((s) => ({ label: s.label, value: user?.[s.field] ?? 0 }))}
                  />
                  {/* 🔢 오른쪽: 기존 숫자 지표 */}
                  <div className={styles.statsNumeric}>
                    {STAT_DISPLAY.map((s) => (
                      <div key={s.field} className={styles.statBox}>
                        <span className={styles.statIcon}>{s.icon}</span>
                        <span className={styles.statName}>{s.label}</span>
                        <strong className={styles.statVal}>{user?.[s.field] ?? 0}</strong>
                      </div>
                    ))}
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
                  <span className={styles.profileLabel}>매칭 상태</span>
                  <span className={user?.is_seeking !== false ? styles.seekingTagActive : styles.seekingTagPaused}>
                    {user?.is_seeking !== false ? '🟢 소일거리 매칭 중' : '⚪ 소일거리 매칭 일시정지'}
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
            {/* ⚡ 중앙 커다란 자동매칭 히어로 카드 */}
            <section className={styles.aiMatchingHeroSection}>
              <div className={`glass-card ${styles.aiMatchingHeroCard}`}>
                <div className={styles.aiMatchingHeroHeader}>
                  <span className={styles.aiMatchingHeroBadge}>✨ Smart Match</span>
                  <div className={styles.aiMatchingHeroIconArea}>
                    <span className={styles.aiMatchingHeroIcon} title="마스코트 소일이">🌱</span>
                  </div>
                  <h3 className={styles.aiMatchingHeroTitle}>
                    {isFarmer ? '⚡ 최적의 청년 일손 찾기' : '⚡ 나에게 딱 맞는 농부(일자리) 찾기'}
                  </h3>
                  <p className={styles.aiMatchingHeroSub}>
                    {isFarmer ? (
                      <>도우미 '소일이'가 충주 등 청정 농가의 조건에 맞는<br />최적의 청년 일손을 매칭해 드립니다</>
                    ) : (
                      <>도우미 '소일이'가 내 유형검사 결과와 거주 지역을 분석하여<br />최적의 농가 일자리를 매칭해 드립니다</>
                    )}
                  </p>

                  {/* 📝 [피드백 반영] 농부는 "구직 희망" 개념이 없다(청년의 구직 희망
                      여부에 따라 농부가 후보를 고르는 구조). 그래서 매칭 ON/OFF 토글 대신,
                      곧바로 업무별 후보자 탐색 화면으로 안내하는 버튼만 보여준다. */}
                  {!isFarmer && (
                    <div className={styles.heroStatusTextWrapper}>
                      <div className={styles.heroStatusMainBadge}>
                        <span className={styles.heroStatusLabel}>현재 매칭 상태:</span>
                        <strong className={user?.is_seeking !== false ? styles.heroStatusActiveText : styles.heroStatusPausedText}>
                          {user?.is_seeking !== false ? '🟢 소일거리 매칭 진행 중' : '⚪ 소일거리 매칭 일시정지'}
                        </strong>
                      </div>
                      <p className={styles.heroStatusHintText}>
                        {user?.is_seeking !== false
                          ? '👇 아래 버튼을 터치하면 매칭이 일시정지됩니다'
                          : '👇 아래 버튼을 터치하면 매칭이 시작됩니다'}
                      </p>
                    </div>
                  )}
                  {isFarmer && (
                    <div className={styles.heroStatusTextWrapper}>
                      <p className={styles.heroStatusHintText}>
                        👇 아래 버튼을 눌러 필요한 업무를 선택하고, 매칭을 희망하는 청년 후보를 살펴보세요
                      </p>
                    </div>
                  )}
                </div>

                {isFarmer ? (
                  <button
                    type="button"
                    className={`btn btn-primary ${styles.emptyCtaBtn}`}
                    onClick={() => navigate('/matching')}
                  >
                    🌾 업무별 청년 후보 보러가기
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${styles.giantSeekingToggleBtn} ${
                      user?.is_seeking !== false ? styles.giantSeekingActive : styles.giantSeekingPaused
                    }`}
                    onClick={handleToggleSeeking}
                    disabled={togglingSeeking}
                    title={user?.is_seeking !== false ? '터치하여 매칭 일시정지' : '터치하여 매칭 활성화'}
                  >
                    <div className={styles.giantSeekingSingleIcon}>
                      {togglingSeeking ? '⏳' : '⏻'}
                    </div>
                  </button>
                )}
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
                        {m.partner_role === '농부' ? '👨‍🌾' : '🌱'}
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
                <label className={styles.formLabel}>이름 (닉네임) <span className={styles.required}>(필수)</span></label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="이름을 입력하세요"
                  required
                />
              </div>

              {/* 2. 거주 지역 (도, 시 나눠서 필수 입력) */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>거주 지역 <span className={styles.required}>(필수)</span></label>
                <div className={styles.locationGrid}>
                  <select
                    className={styles.formInput}
                    value={editFormData.province}
                    onChange={(e) => setEditFormData({ ...editFormData, province: e.target.value })}
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

                  {editFormData.province === '충청북도' ? (
                    <select
                      className={styles.formInput}
                      value={editFormData.city}
                      onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
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
                      type="text"
                      className={styles.formInput}
                      placeholder="시/군/구 입력 (예: 부천시)"
                      value={editFormData.city}
                      onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                      required
                    />
                  )}
                </div>
              </div>

              {/* 3. 소일거리 매칭 상태 토글 */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>매칭 상태</label>
                <div className={styles.toggleRow}>
                  <span className={styles.toggleDesc}>
                    {editFormData.is_seeking
                      ? '🟢 소일거리 매칭 중 (추천 활성화)'
                      : '⚪ 소일거리 매칭 일시정지 (추천 제외)'}
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

      {/* 🔍 [피드백 반영] 내 정보 화면에서 "추천업무" 배지를 클릭하면, 적성검사 결과
          화면에 있던 "AI 분석 상세하게 보기" 내용을 그대로 팝업으로 확인할 수 있다. */}
      {showTaskAnalysisModal && recommendedTask && (
        <div className={styles.modalOverlay} onClick={() => setShowTaskAnalysisModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>🔍 AI 분석 상세하게 보기</h3>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setShowTaskAnalysisModal(false)}
              >
                ✕
              </button>
            </div>
            <div className={styles.modalForm}>
              <div className={styles.recommendedTaskModalTitle}>
                ✨ 추천 농사 분야: <strong>{recommendedTask.task}</strong>
              </div>
              {recommendedTask.message && (
                <p className={styles.recommendedTaskModalText}>{recommendedTask.message}</p>
              )}
              {recommendedTask.ai_reason && (
                <p className={styles.recommendedTaskModalText}>{recommendedTask.ai_reason}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🌱 적성검사 안내 당근/토스 럭셔리 모달 팝업 */}
      {showAptitudeNoticeModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAptitudeNoticeModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()} style={{ padding: '26px 20px', textAlign: 'center' }}>
            <div className={styles.noticeModalIcon}>🌱</div>
            <h3 className={styles.noticeModalTitle}>맞춤 적성검사 안내</h3>
            <p className={styles.noticeModalDesc}>
              나에게 딱 맞는 농가 일자리를 AI 추천받기 위해<br />
              <strong>적성검사 (1분 소요)</strong>를 먼저 진행해 주세요!
            </p>
            <div className={styles.modalActionGroup} style={{ marginTop: '18px' }}>
              <button
                type="button"
                className={`btn btn-outline ${styles.modalCancelBtn}`}
                onClick={() => setShowAptitudeNoticeModal(false)}
              >
                닫기
              </button>
              <button
                type="button"
                className={`btn btn-primary ${styles.modalSubmitBtn}`}
                onClick={() => {
                  setShowAptitudeNoticeModal(false);
                  navigate('/aptitude');
                }}
              >
                🌱 적성검사 시작하기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
