import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { matchingAPI, aptitudeAPI } from '../../api/index'
import { useAuth } from '../../store/AuthContext'
import styles from './Matching.module.css'

export default function Matching() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()

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
      // 나에게 맞는 업무는 1순위 1개만 보여준다
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
      alert('매칭 대기 등록이 완료됐어요!')
    } catch (err) {
      alert('매칭 신청 실패: ' + (err.response?.data?.detail || '오류 발생'))
    }
  }

  const handleCancelMatch = async () => {
    try {
      await matchingAPI.cancelMatchRequest()
      setSeeking(false)
      await refreshUser?.()
      alert('매칭 대기를 취소했어요.')
    } catch (err) {
      alert('매칭 취소 실패: ' + (err.response?.data?.detail || '오류 발생'))
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
      alert('선택된 업무가 없습니다.')
      return
    }

    try {
      const res = await matchingAPI.createMatchByTask(selectedTask, employeeId)
      const matchId = res.data?.match_id || res.data?.id
      
      alert(`선택하신 지원자 #${employeeId}님과 매칭이 완료되었습니다! 대화방으로 이동합니다.`)
      setCandidates((prev) => prev.filter((c) => c.user_id !== employeeId))
      
      if (matchId) {
        navigate(`/chat/${matchId}`)
      } else {
        navigate('/chat')
      }
    } catch (err) {
      alert('매칭 생성 실패: ' + (err.response?.data?.detail || '오류 발생'))
    }
  }

  if (!user) {
    return <div className={styles.emptyText}>로그인 후 이용해주세요.</div>
  }

  if (loading) {
    return <div className={styles.emptyText}>매칭 정보를 불러오는 중입니다...</div>
  }

  if (user.role === '청년') {
    return (
      <div className={styles.container}>
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => navigate('/home')}>← 메인화면으로</button>
        </div>
        <h1 className={styles.title}>👨‍🌾 나에게 맞는 농사 업무</h1>

        {statsEmpty ? (
          <div className={styles.candidateList}>
            <p className={styles.emptyText}>먼저 적성검사를 완료해주세요.</p>
            <button className={styles.matchBtn} onClick={() => navigate('/aptitude')}>적성검사 하러가기</button>
          </div>
        ) : (
          <>
            <div className={styles.candidateList}>
              {/* 스텟 기반으로 가장 잘 맞는 업무 1개만 표시 */}
              {tasks.slice(0, 1).map((item) => (
                <div key={item.task} className={styles.candidateCard}>
                  <div className={styles.candidateName}>{item.task}</div>
                  <p>{item.message}</p>
                </div>
              ))}
            </div>
            <div className={styles.actionRow}>
              {seeking ? (
                <button className={styles.matchBtn} onClick={handleCancelMatch}>매칭 대기 취소하기</button>
              ) : (
                <>
                  <button className={styles.matchBtn} onClick={handleRequestMatch} disabled={tasks.length === 0}>매칭 신청하기</button>
                  <button className={styles.secondaryBtn} onClick={() => navigate('/home')}>메인화면으로</button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate('/home')}>← 메인화면으로</button>
      </div>
      <h1 className={styles.title}>👨‍🌾 업무별 추천 후보자 조회</h1>
      <div className={styles.selectGroup}>
        <label>업무 선택:</label>
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
            <button className={styles.matchBtn} onClick={() => handleCreateMatch(c.user_id)}>이 후보자와 매칭하기</button>
          </div>
        ))}
        {selectedTask && candidates.length === 0 && (
          <p className={styles.emptyText}>현재 '{selectedTask}' 업무를 희망하는 매칭 대기 지원자가 없습니다.</p>
        )}
      </div>
    </div>
  )
}