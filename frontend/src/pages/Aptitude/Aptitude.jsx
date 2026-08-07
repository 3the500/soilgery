import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { aptitudeAPI } from '../../api/index'
import { useAuth } from '../../store/AuthContext'
import styles from './Aptitude.module.css'

const OPTIONS = ['예', '아니요']

const STAT_LABELS = {
  strength: '근력',
  stamina: '체력',
  grit: '근성',
  intelligence: '지성',
  wage_pref: '급여',
  personality: '성격',
}

export default function Aptitude() {
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
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

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
    }
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    }
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
      const res = await aptitudeAPI.submitTest({ answers })
      setResult(res.data)
      // 새로 계산된 스텟을 캐시된 로그인 정보에도 반영 (안 그러면 홈 화면 등에서
      // "스텟이 전부 0"이라고 잘못 판단해 매칭 시 적성검사를 또 요구하게 됨)
      await refreshUser?.()
    } catch (err) {
      alert('검사 제출 실패: ' + (err.response?.data?.detail || '오류 발생'))
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>🌱 적성검사 결과</h2>
        <p style={{ textAlign: 'center', marginBottom: '16px' }}>검사가 완료됐어요! 나의 스텟은 다음과 같습니다.</p>
        <div className={styles.resultGrid}>
          {Object.entries(STAT_LABELS).map(([field, label]) => (
            <div key={field} className={styles.resultRow}>
              <span>{label}</span>
              <strong>{result[field]}</strong>
            </div>
          ))}
        </div>
        <div className={styles.btnGroup}>
          <button className={styles.navBtn} onClick={() => { setResult(null); setAnswers({}); setCurrentIndex(0); }}>
            다시 검사하기
          </button>
          <button className={styles.navBtn} onClick={() => navigate('/matching')}>
            🌾 매칭하러 가기
          </button>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]
  const isFirst = currentIndex === 0
  const isLast = questions.length > 0 && currentIndex === questions.length - 1

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>농촌 소일거리 적성검사</h1>
      {loadError && <p style={{ color: '#ff6b6b', textAlign: 'center' }}>{loadError}</p>}

      {questions.length > 0 && currentQuestion && (
        <form onSubmit={handleSubmit}>
          <div className={styles.progressBar}>
            {currentIndex + 1} / {questions.length}
          </div>

          <div className={styles.questionCard}>
            <p className={styles.questionText}>
              {currentIndex + 1}. {currentQuestion.text}
            </p>

            <div className={styles.optionsGroup}>
              {OPTIONS.map((opt) => (
                <label key={opt} className={styles.optionLabel}>
                  <input
                    type="radio"
                    className={styles.radioInput}
                    name={`q_${currentQuestion.id}`}
                    checked={answers[currentQuestion.id] === opt}
                    onChange={() => handleSelect(currentQuestion.id, opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.btnGroup}>
            <div>
              {!isFirst && (
                <button type="button" className={styles.navBtn} onClick={handlePrev}>
                  &lt; 이전
                </button>
              )}
            </div>

            <div>
              {!isLast ? (
                <button type="button" className={styles.navBtn} onClick={handleNext}>
                  다음 &gt;
                </button>
              ) : (
                <button type="submit" className={styles.navBtn} disabled={loading || !allAnswered}>
                  {loading ? '분석 중...' : '결과 제출하기'}
                </button>
              )}
            </div>
          </div>
        </form>
      )}
    </div>
  )
}