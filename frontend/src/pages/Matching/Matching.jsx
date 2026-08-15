import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { matchingAPI, aptitudeAPI } from '../../api/index'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../context/ToastContext'
import styles from './Matching.module.css'

const TASK_CARDS = [
  {
    value: '밭일',
    emoji: '🍎',
    title: '밭일 · 과수 수확',
    desc: '수확, 파종 등 기본 농작업',
  },
  {
    value: '농기구 운용',
    emoji: '🚜',
    title: '농기구 운용',
    desc: '트랙터, 관리기 등 농기계 조작',
  },
  {
    value: '물건 나르기',
    emoji: '📦',
    title: '운반 · 농가 정리',
    desc: '수확물 적재, 창고 정리',
  },
  {
    value: '시설정비',
    emoji: '🔧',
    title: '시설정비',
    desc: '하우스, 농기자재 등 시설 보수',
  },
  {
    value: '선별 및 포장',
    emoji: '🧺',
    title: '선별 및 포장',
    desc: '농산물 선별, 상품 포장 작업',
  },
  {
    value: '가공',
    emoji: '🏭',
    title: '가공',
    desc: '농산물 세척·건조·가공 작업',
  },
]

function calculateLevel(exp = 0) {
  if (exp >= 1000) return { level: 5, title: '🌾 일손 달인' }
  if (exp >= 600) return { level: 4, title: '🌟 베테랑' }
  if (exp >= 300) return { level: 3, title: '⚡ 유망주' }
  if (exp >= 100) return { level: 2, title: '🌱 루키' }
  return { level: 1, title: '🐣 첫걸음' }
}

export default function Matching() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [tasks, setTasks] = useState([])
  const [statsEmpty, setStatsEmpty] = useState(false)
  const [seeking, setSeeking] = useState(user?.is_seeking ?? false)
  const [selectedTask, setSelectedTask] = useState('')
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)

  const taskOptions = ['밭일', '농기구 운용', '물건 나르기', '시설정비', '선별 및 포장', '가공']

  useEffect(() => {
    if (!user) return

    if (user.role === '청년') {
      Promise.all([
        matchingAPI.getRecommendedTasks(1),
        aptitudeAPI.getMyStats(),
      ])
        .then(([taskRes, statsRes]) => {
          setTasks(taskRes.data)
          const stats = statsRes.data || {}
          const allZero = Object.values(stats).every((v) => !v)
          setStatsEmpty(allZero)
        })
        .catch((err) => console.error('추천 업무 조회 실패:', err))
        .finally(() => setLoading(false))
    } else if (user.role === '농부') {
      // 👨‍🌾 농부 회원 진입 시 기본 선택('밭일') 후보자 목록을 바로 자동 로드!
      handleSelectTask('밭일')
      setLoading(false)
    } else {
      setLoading(false)
    }
  }, [user])

  const handleRequestMatch = async () => {
    try {
      await matchingAPI.requestMatch()
      setSeeking(true)
      await refreshUser?.()
      showToast('소일거리 매칭 신청이 성공적으로 완료되었습니다! ⚡', 'success')
    } catch (err) {
      showToast('매칭 신청 실패: ' + (err.response?.data?.detail || '오류 발생'), 'error')
    }
  }

  const handleCancelMatch = async () => {
    try {
      await matchingAPI.cancelMatchRequest()
      setSeeking(false)
      await refreshUser?.()
      showToast('매칭 대기를 취소했어요.', 'info')
    } catch (err) {
      showToast('매칭 취소 실패: ' + (err.response?.data?.detail || '오류 발생'), 'error')
    }
  }

  const handleSelectTask = async (taskName) => {
    setSelectedTask(taskName)
    if (!taskName) {
      setCandidates([])
      return
    }

    try {
      const res = await matchingAPI.getCandidatesByTask(taskName)
      const candidateData = Array.isArray(res.data) ? res.data : []
      setCandidates(candidateData)
    } catch (err) {
      console.error('후보자 조회 실패:', err)
      showToast('후보자 목록을 불러오지 못했습니다.', 'error')
      setCandidates([])
    }
  }

  const handleCreateMatch = async (employeeId) => {
    if (!selectedTask) {
      showToast('선택된 업무가 없습니다.', 'error')
      return
    }

    try {
      const res = await matchingAPI.createMatchByTask(selectedTask, employeeId)
      const matchId = res.data?.match_id || res.data?.id
      
      showToast(`청년 지원자님과 매칭 대화방이 개설되었습니다! 🎉`, 'success')
      setCandidates((prev) => (Array.isArray(prev) ? prev.filter((c) => c.user_id !== employeeId) : []))
      
      if (matchId) {
        navigate(`/chat/${matchId}`)
      } else {
        navigate('/chat')
      }
    } catch (err) {
      console.error('매칭 생성 에러:', err)
      showToast('매칭 생성 실패: ' + (err.response?.data?.detail || '오류가 발생했습니다.'), 'error')
    }
  }

  if (!user) {
    return <div className={styles.emptyText}>로그인 후 이용해주세요.</div>
  }

  if (loading) {
    return <div className={styles.emptyText}>매칭 정보를 불러오는 중입니다...</div>
  }

  // 🧑‍🌾 청년 회원 전용 매칭 화면
  if (user.role === '청년') {
    return (
      <div className={styles.container}>
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => navigate('/home?tab=matching')}>← 홈으로</button>
        </div>
        <h1 className={styles.title}>🌾 소일거리 추천 농사 업무 & 매칭</h1>

        {statsEmpty ? (
          <div className={styles.candidateList}>
            <p className={styles.emptyText}>먼저 적성검사를 완료해 주세요.</p>
            <button className={styles.matchBtn} onClick={() => navigate('/aptitude')}>🌱 적성검사 하러가기</button>
          </div>
        ) : (
          <div className={styles.matchContentBox}>
            {/* 스텟 기반으로 가장 잘 맞는 업무 1개 표시 */}
            {tasks.slice(0, 1).map((item) => (
              <div key={item.task} className={styles.recommendTaskCard}>
                <span className={styles.taskCardBadge}>✨ 추천 농업 분야</span>
                <h3 className={styles.taskCardTitle}>{item.task}</h3>
                <p className={styles.taskCardDesc}>{item.message}</p>
              </div>
            ))}

            {/* seeking(매칭 신청/대기) 상태에 따른 안내 및 버튼 */}
            {seeking ? (
              <div className={styles.seekingNoticeCard}>
                <div className={styles.seekingHeader}>
                  <span className={styles.seekingIcon}>🌱</span>
                  <div className={styles.seekingTitleGroup}>
                    <h3>⚡ 소일거리 매칭 진행 중...</h3>
                    <span className={styles.seekingBadge}>농부 회원의 구직 선택을 기다리고 있어요</span>
                  </div>
                </div>

                <div className={styles.seekingInfoBox}>
                  <p className={styles.seekingMainText}>
                    현재 농부 회원이 일손을 찾을 수 있도록 <strong>구직(매칭 대기)</strong> 상태로 활성화되어 있습니다!
                  </p>
                  <p className={styles.seekingSubText}>
                    💬 <strong>안내:</strong> 매칭을 기다리는 동안 홈에서 다른 작업을 하고 계셔도 됩니다. 농부 회원이 선택하는 즉시 <strong>실시간 채팅방이 개설되며 알림이 도착합니다!</strong>
                  </p>
                </div>

                <div className={styles.actionRowVertical}>
                  <button className={`btn btn-primary ${styles.primaryHomeBtn}`} onClick={() => navigate('/home?tab=matching')}>
                    🌱 홈으로 돌아가기
                  </button>
                  <button className={styles.cancelMatchBtn} onClick={handleCancelMatch}>
                    매칭 대기 취소하기
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.readyNoticeCard}>
                <p className={styles.readyText}>
                  위 추천 분야 조건으로 나를 찾아줄 농부 회원에게 <strong>구직(매칭)</strong>을 신청하시겠습니까?
                </p>
                <div className={styles.actionRowVertical}>
                  <button className={`btn btn-primary ${styles.startMatchBtn}`} onClick={handleRequestMatch}>
                    ⚡ 이 조건으로 매칭 신청하기 ⚡
                  </button>
                  <button className={styles.secondaryBtn} onClick={() => navigate('/home?tab=matching')}>
                    홈으로 돌아가기
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // 👨‍🌾 농부 회원 전용 구인 매칭 화면
  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate('/home?tab=matching')}>← 홈으로</button>
      </div>
      <div className={styles.farmerHeaderCard}>
        <h1 className={styles.title}>👨‍🌾 필요한 농사 업무를 선택해 주세요</h1>
        <p className={styles.farmerSubText}>선택한 업무에 맞는 우수 청년 지원자를 AI가 자동 추천합니다.</p>
        <div className={styles.scoreHintRow}>
          <span className={styles.scoreHintIcon}>⚡</span>
          <span className={styles.scoreHintText}>AI 추천 점수는 <strong>체력·성실성·숙련도·협동심</strong> 등 6개 적성 항목을, 선택한 업무에서 더 중요한 항목일수록 가중치를 두어 비교 분석한 뒤 산출됩니다.</span>
        </div>

        <div className={styles.taskCleanGrid}>
          {TASK_CARDS.map((cat) => {
            const isSelected = selectedTask === cat.value
            return (
              <button
                key={cat.value}
                type="button"
                className={`${styles.taskCleanBtn} ${isSelected ? styles.taskCleanBtnActive : ''}`}
                onClick={() => handleSelectTask(cat.value)}
              >
                <span className={styles.cleanEmoji}>{cat.emoji}</span>
                <span className={styles.cleanTitle}>{cat.title}</span>
                <span className={styles.cleanDesc}>{cat.desc}</span>
                {isSelected && <span className={styles.cleanSelected}>✔ 선택됨</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className={styles.candidateList}>
        {Array.isArray(candidates) &&
          candidates.map((c, index) => {
            if (!c) return null
            const rank = index + 1
            // [피드백 반영] fit_score(백엔드에서 업무별 스텟 가중치를 반영해 계산)를
            // 그대로 사용하되, 예전에는 78~99점으로 범위를 너무 좁게 묶어놔서
            // 서로 다른 스텟 패턴의 후보자도 같은 점수로 보이는 문제가 있었다.
            // 아래쪽 범위를 넓혀 실제 적합도 차이가 점수에 드러나도록 조정했다.
            const matchPercent = Math.min(99, Math.max(40, Math.round(99 - (c.fit_score || 0) * 1.3)))
            const levelInfo = calculateLevel(c.exp || 0)
            const ratingNum = c.rating ? Number(c.rating).toFixed(1) : '5.0'

            const rankClass = rank === 1 ? styles.rankCardGold : rank === 2 ? styles.rankCardSilver : rank === 3 ? styles.rankCardBronze : ''
            const rankBadgeText = rank === 1 ? '🥇 1위 최우수 추천' : rank === 2 ? '🥈 2위 우수 추천' : rank === 3 ? '🥉 3위 추천' : null

            // 💡 눈에 띄는 핵심 추천 이유 태그 생성
            const stats = c.stats || {}
            const reasons = [] // { label, emoji, color }

            // 직무 적합도 (matchPercent 기반)
            if (matchPercent >= 90)
              reasons.push({ label: '직무 적합 최적!', emoji: '🎯', color: 'green' })
            else if (matchPercent >= 84)
              reasons.push({ label: '직무 적합 우수!', emoji: '✅', color: 'green' })

            // 즉시 투입 가능 여부
            if (c.is_seeking)
              reasons.push({ label: '즉시 투입 가능!', emoji: '⚡', color: 'amber' })

            // 평점 기반
            if (Number(c.rating) >= 4.8)
              reasons.push({ label: '평점 최상위!', emoji: '🌟', color: 'gold' })
            else if (Number(c.rating) >= 4.5)
              reasons.push({ label: '후기 평점 우수!', emoji: '⭐', color: 'gold' })

            // 성실성 최상위
            if ((stats.grit || 0) >= 8)
              reasons.push({ label: '성실성 탁월!', emoji: '🔥', color: 'orange' })

            // 체력
            if ((stats.stamina || 0) >= 8)
              reasons.push({ label: '체력 최상급!', emoji: '💪', color: 'blue' })

            // 숙련도 (농기계 등)
            if ((stats.intelligence || 0) >= 8)
              reasons.push({ label: '농기계 숙련자!', emoji: '🚜', color: 'teal' })

            // 경험 풍부
            if ((c.exp || 0) >= 300)
              reasons.push({ label: '현장 경험 풍부!', emoji: '🏆', color: 'purple' })

            // 최대 3개만 표시
            const topReasons = reasons.slice(0, 3)

            return (
              <div key={c.user_id || index} className={`${styles.candidateCard} ${rankClass}`}>

                {/* 상단: 순위뱃지(좌) / AI추천점수(우) */}
                <div className={styles.cardTopRow}>
                  <div className={styles.cardTopLeft}>
                    {rankBadgeText && (
                      <span className={`${styles.rankBadge} ${styles[`rankBadge${rank}`]}`}>
                        {rankBadgeText}
                      </span>
                    )}
                  </div>
                  <div className={styles.fitScoreBadge}>
                    ⚡ AI 추천 점수 <strong>{matchPercent}점</strong>
                  </div>
                </div>

                {/* 프로필 이미지 + 이름 + 위치 */}
                <div className={styles.candidateNameRow}>
                  <div className={styles.candidateAvatar}>
                    {c.profile_image
                      ? <img src={c.profile_image} alt="프로필" className={styles.avatarImg} />
                      : <span className={styles.avatarFallback}>👤</span>
                    }
                  </div>
                  <div className={styles.candidateNameInfo}>
                    <span className={styles.candidateName}>{c.name || '청년 지원자'}</span>
                    {c.location && (
                      <span className={styles.candidateLocation}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
                        {c.location}
                      </span>
                    )}
                  </div>
                </div>

                {/* 구분선 */}
                <div className={styles.cardDivider} />

                {/* 평점·레벨 + 추천이유 한 줄 통합 */}
                <div className={styles.cardInfoRow}>
                  <span className={styles.metricItem}>⭐ <strong>{ratingNum}점</strong></span>
                  <span className={styles.metricDot}>·</span>
                  <span className={styles.metricItem}>🏆 <strong>Lv.{levelInfo.level}</strong> {levelInfo.title}</span>
                  {topReasons.length > 0 && <span className={styles.metricDot}>·</span>}
                  {topReasons.map((r, i) => (
                    <span key={i} className={`${styles.reasonTag} ${styles[`reasonTag_${r.color}`]}`}>
                      {r.emoji} {r.label}
                    </span>
                  ))}
                </div>

                <button className={styles.matchBtn} onClick={() => handleCreateMatch(c.user_id)}>이 청년과 매칭하기 (대화방 개설)</button>
              </div>
            )
          })}
        {selectedTask && Array.isArray(candidates) && candidates.length === 0 && (
          <p className={styles.emptyText}>현재 '{selectedTask}' 업무를 희망하는 대기 청년 지원자가 없습니다. 🌾</p>
        )}
      </div>
    </div>
  )
}