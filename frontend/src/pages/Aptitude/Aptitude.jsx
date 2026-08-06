import { useState, useEffect } from 'react'
import { aptitudeAPI } from '../../api/index'

// 백엔드(aptitude_test.py)의 질문은 모두 "예" / "아니요" 두 가지 답만 존재하고,
// GET /aptitude-test/questions 응답에는 id, text만 내려온다 (선택지는 내려오지 않음)
const OPTIONS = ['예', '아니요']

// 스텟 응답(StatsResponse)의 영문 필드명 -> 화면에 보여줄 한글 라벨
const STAT_LABELS = {
  strength: '근력',
  stamina: '체력',
  grit: '근성',
  intelligence: '지성',
  wage_pref: '급여',
  personality: '성격',
}

export default function Aptitude() {
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    // 질문 목록 로드 (응답은 [{id, text}, ...] 형태의 배열 그 자체)
    aptitudeAPI.getQuestions()
      .then((res) => setQuestions(res.data))
      .catch((err) => {
        console.error('질문 불러오기 실패:', err)
        setLoadError('질문을 불러오지 못했습니다.')
      })
  }, [])

  const handleSelect = (qId, option) => {
    setAnswers((prev) => ({ ...prev, [qId]: option }))
  }

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!allAnswered) {
      alert('모든 질문에 답해주세요.')
      return
    }
    setLoading(true)
    try {
      // 백엔드 AnswerSubmission: { answers: { q1: "예", q2: "아니요", ... } }
      const res = await aptitudeAPI.submitTest({ answers })
      setResult(res.data) // StatsResponse: { strength, stamina, grit, intelligence, wage_pref, personality }
    } catch (err) {
      alert('검사 제출 실패: ' + (err.response?.data?.detail || '오류 발생'))
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div style={{ padding: '20px' }}>
        <h2>🌱 적성검사 결과</h2>
        <p>검사가 완료됐어요! 나의 스텟은 다음과 같습니다.</p>
        <div style={{ display: 'grid', gap: '8px', maxWidth: '360px' }}>
          {Object.entries(STAT_LABELS).map(([field, label]) => (
            <div key={field} style={{ display: 'flex', justifyContent: 'space-between', border: '1px solid #eee', padding: '8px 12px', borderRadius: '6px' }}>
              <span>{label}</span>
              <strong>{result[field]}</strong>
            </div>
          ))}
        </div>
        <button onClick={() => { setResult(null); setAnswers({}) }} style={{ marginTop: '16px' }}>
          다시 검사하기
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>농촌 소일거리 적성검사</h1>
      {loadError && <p style={{ color: 'red' }}>{loadError}</p>}
      <form onSubmit={handleSubmit}>
        {questions.map((q, idx) => (
          <div key={q.id} style={{ marginBottom: '20px' }}>
            <p><strong>{idx + 1}. {q.text}</strong></p>
            {OPTIONS.map((opt) => (
              <label key={opt} style={{ display: 'inline-block', marginRight: '20px' }}>
                <input
                  type="radio"
                  name={`q_${q.id}`}
                  checked={answers[q.id] === opt}
                  onChange={() => handleSelect(q.id, opt)}
                />
                {' '}{opt}
              </label>
            ))}
          </div>
        ))}
        {questions.length > 0 && (
          <button type="submit" disabled={loading || !allAnswered}>
            {loading ? '분석 중...' : '결과 제출하기'}
          </button>
        )}
      </form>
    </div>
  )
}