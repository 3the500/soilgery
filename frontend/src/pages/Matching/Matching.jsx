import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { matchingAPI, aptitudeAPI } from '../../api/index'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../context/ToastContext'
import styles from './Matching.module.css'

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

  const taskOptions = ['밭일', '트렉터 운용', '물건 나르기']

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
      setCandidates(res.data)
    } catch (err) {
      console.error('후보자 조회 실패:', err)
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
      
      showToast(`지원자 #${employeeId}님과 매칭 대화방이 개설되었습니다! 🎉`, 'success')
      setCandidates((prev) => prev.filter((c) => c.user_id !== employeeId))
      
      if (matchId) {
        navigate(`/chat/${matchId}`)
      } else {
        navigate('/chat')
      }
    } catch (err) {
      showToast('매칭 생성 실패: ' + (err.response?.data?.detail || '오류 발생'), 'error')
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
          <button className={styles.backBtn} onClick={() => navigate('/home?tab=matching')}>← 메인화면</button>
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
                    💬 <strong>안내:</strong> 매칭을 기다리는 동안 메인 화면에서 다른 작업을 하고 계셔도 됩니다. 농부 회원이 선택하는 즉시 <strong>실시간 채팅방이 개설되며 알림이 도착합니다!</strong>
                  </p>
                </div>

                <div className={styles.actionRowVertical}>
                  <button className={`btn btn-primary ${styles.primaryHomeBtn}`} onClick={() => navigate('/home?tab=matching')}>
                    🌱 메인화면으로 이동하기
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
                    메인화면으로 돌아가기
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
        <button className={styles.backBtn} onClick={() => navigate('/home?tab=matching')}>← 메인화면</button>
      </div>
      <h1 className={styles.title}>👨‍🌾 업무별 추천 청년 후보자 조회</h1>
      <div className={styles.selectGroup}>
        <label>필요한 업무 선택:</label>
        <select 
          className={styles.selectBox}
          value={selectedTask} 
          onChange={(e) => handleSelectTask(e.target.value)}
        >
          <option value="" disabled>업무를 선택하세요</option>
          {taskOptions.map((task) => (
            <option key={task} value={task}>
              {task}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.candidateList}>
        {candidates.map((c) => (
          <div key={c.user_id} className={styles.candidateCard}>
            <div className={styles.candidateName}>
              👤 {c.name ? `${c.name} (#${c.user_id})` : `지원자 #${c.user_id}`} {c.location && `📍 ${c.location}`}
            </div>
            <div className={styles.fitScore}>
              💡 적합도 거리(낮을수록 우수): {typeof c.fit_score === 'number' ? c.fit_score.toFixed(2) : c.fit_score}
            </div>
            <button className={styles.matchBtn} onClick={() => handleCreateMatch(c.user_id)}>이 청년과 매칭하기 (대화방 개설)</button>
          </div>
        ))}
        {selectedTask && candidates.length === 0 && (
          <p className={styles.emptyText}>현재 '{selectedTask}' 업무를 희망하는 매칭 대기 지원자가 없습니다.</p>
        )}
      </div>
    </div>
  )
}