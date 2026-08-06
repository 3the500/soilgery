import { useState, useEffect } from 'react'
import { matchingAPI, postingAPI } from '../../api/index'
import { useAuth } from '../../store/AuthContext'

export default function Matching() {
  const { user } = useAuth()

  // 청년: 추천 업무 목록 + 매칭 신청 상태
  const [tasks, setTasks] = useState([])
  const [seeking, setSeeking] = useState(user?.is_seeking ?? false)

  // 농부: 본인 공고 목록 + 선택된 공고의 후보자 목록
  const [myPostings, setMyPostings] = useState([])
  const [selectedPostingId, setSelectedPostingId] = useState(null)
  const [candidates, setCandidates] = useState([])

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    if (user.role === '청년') {
      matchingAPI.getRecommendedTasks(3)
        .then((res) => setTasks(res.data)) // [{ task, distance, message }, ...]
        .catch((err) => console.error('추천 업무 조회 실패:', err))
        .finally(() => setLoading(false))
    } else if (user.role === '농부') {
      postingAPI.getPostings('open')
        .then((res) => setMyPostings(res.data.filter((p) => p.employer_id === user.id)))
        .catch((err) => console.error('공고 목록 조회 실패:', err))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [user])

  const handleRequestMatch = async () => {
    try {
      await matchingAPI.requestMatch()
      setSeeking(true)
      alert('매칭 대기 등록이 완료됐어요!')
    } catch (err) {
      alert('매칭 신청 실패: ' + (err.response?.data?.detail || '오류 발생'))
    }
  }

  const handleCancelMatch = async () => {
    try {
      await matchingAPI.cancelMatchRequest()
      setSeeking(false)
      alert('매칭 대기를 취소했어요.')
    } catch (err) {
      alert('매칭 취소 실패: ' + (err.response?.data?.detail || '오류 발생'))
    }
  }

  const handleSelectPosting = async (postingId) => {
    setSelectedPostingId(postingId)
    try {
      const res = await matchingAPI.getCandidates(postingId, true)
      setCandidates(res.data) // [{ user_id, stats, fit_score }, ...]
    } catch (err) {
      console.error('후보자 조회 실패:', err)
      setCandidates([])
    }
  }

  const handleCreateMatch = async (employeeId) => {
    try {
      await matchingAPI.createMatch(selectedPostingId, employeeId)
      alert('매칭이 생성됐어요! 채팅에서 대화를 시작할 수 있습니다.')
      setCandidates((prev) => prev.filter((c) => c.user_id !== employeeId))
    } catch (err) {
      alert('매칭 생성 실패: ' + (err.response?.data?.detail || '오류 발생'))
    }
  }

  if (!user) {
    return <div style={{ padding: '20px' }}>로그인 후 이용해주세요.</div>
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>매칭 정보를 불러오는 중입니다...</div>
  }

  // ── 청년 화면: 추천 업무 + 매칭 신청/취소 ──────────────────────
  if (user.role === '청년') {
    return (
      <div style={{ padding: '20px' }}>
        <h1>👨‍🌾 나에게 맞는 농사 업무</h1>
        <div style={{ display: 'grid', gap: '15px', marginBottom: '20px' }}>
          {tasks.map((item) => (
            <div key={item.task} style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px' }}>
              <h3>{item.task}</h3>
              <p>{item.message}</p>
            </div>
          ))}
          {tasks.length === 0 && <p>먼저 적성검사를 완료해주세요.</p>}
        </div>
        {seeking ? (
          <button onClick={handleCancelMatch}>매칭 대기 취소하기</button>
        ) : (
          <button onClick={handleRequestMatch} disabled={tasks.length === 0}>매칭 신청하기</button>
        )}
      </div>
    )
  }

  // ── 농부 화면: 본인 공고 선택 -> 후보자 목록 -> 매칭 ──────────────
  return (
    <div style={{ padding: '20px' }}>
      <h1>👨‍🌾 공고별 추천 후보자</h1>
      <div style={{ marginBottom: '20px' }}>
        <label>공고 선택: </label>
        <select value={selectedPostingId || ''} onChange={(e) => handleSelectPosting(Number(e.target.value))}>
          <option value="" disabled>공고를 선택하세요</option>
          {myPostings.map((p) => (
            <option key={p.id} value={p.id}>{p.title} ({p.task})</option>
          ))}
        </select>
        {myPostings.length === 0 && <p>등록된 공고가 없습니다.</p>}
      </div>

      <div style={{ display: 'grid', gap: '15px' }}>
        {candidates.map((c) => (
          <div key={c.user_id} style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '8px' }}>
            <p>👤 지원자 #{c.user_id}</p>
            <p>💡 적합도(fit score): {c.fit_score.toFixed(2)}</p>
            <button onClick={() => handleCreateMatch(c.user_id)}>이 후보자와 매칭하기</button>
          </div>
        ))}
        {selectedPostingId && candidates.length === 0 && <p>아직 매칭 대기 중인 후보자가 없어요.</p>}
      </div>
    </div>
  )
}