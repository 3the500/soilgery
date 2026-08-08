import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { aptitudeAPI } from '../../api/index'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../context/ToastContext'
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
  const { user, refreshUser } = useAuth()
  const { showToast } = useToast()

  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)

  // 💡 검사 시작 전 소개 화면 제어 상태
  const [isStarted, setIsStarted] = useState(false)

  // 🚫 농부 회원 접근 차단 가이드
  useEffect(() => {
    if (user?.role === '농부') {
      showToast('농부 회원은 적성검사 대상이 아닙니다.', 'info')
      navigate('/home')
    }
  }, [user, navigate])

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
      showToast('모든 질문에 답해주세요.', 'error')
      return
    }
    setLoading(true)
    try {
      const res = await aptitudeAPI.submitTest({ answers })
      setResult(res.data)
      await refreshUser?.()
      showToast('적성검사가 완료되었습니다! 스탯 카드가 업데이트되었어요. 🎉', 'success')
    } catch (err) {
      showToast('검사 제출 실패: ' + (err.response?.data?.detail || '오류 발생'), 'error')
    } finally {
      setLoading(false)
    }
  }

  // 💡 스탯 결과로 추천 농업 분야 산출
  const getRecommendedTaskName = (resObj) => {
    if (!resObj) return '과수원 수확 및 농사 작업'
    const { intelligence = 0, strength = 0, stamina = 0 } = resObj
    if (intelligence >= strength && intelligence >= stamina) {
      return '트랙터 운용 & 스마트 농업'
    } else if (strength >= stamina) {
      return '물건 나르기 & 농작물 운반'
    } else {
      return '밭일 & 과수원 수확 작업'
    }
  }

  // 💡 검사 결과 및 추천 분야 안내 화면
  if (result) {
    const recommendedTask = getRecommendedTaskName(result)
    return (
      <div className={styles.container}>
        <div className={`glass-card ${styles.introCard}`}>
          <div className={styles.topBar}>
            <button type="button" className={styles.backBtn} onClick={() => navigate('/home?tab=matching')}>← 메인화면</button>
          </div>
          <div className={styles.introIconBadge}>📊</div>
          <h2 className={styles.introTitle}>🌱 적성검사 분석 완료</h2>
          <p className={styles.introDesc}>검사 결과를 바탕으로 나의 스탯과 추천 분야가 산출되었습니다!</p>
          
          {/* 스탯 그리드 */}
          <div className={styles.resultGrid}>
            {Object.entries(STAT_LABELS).map(([field, label]) => (
              <div key={field} className={styles.resultRow}>
                <span>{label}</span>
                <strong>{result[field]}</strong>
              </div>
            ))}
          </div>

          {/* 💡 추천 분야 안내 카드 */}
          <div className={styles.recommendNoticeBox}>
            <span className={styles.recommendBadge}>✨ 1순위 추천 농사 분야</span>
            <h3 className={styles.recommendTaskTitle}>{recommendedTask}</h3>
            <p className={styles.recommendTaskDesc}>
              나의 스탯 특성을 고려해 보았을 때 <strong>{recommendedTask}</strong> 분야에 가장 높은 적합도를 보였습니다. 이 추천 분야로 매칭을 신청하실 수 있습니다!
            </p>
          </div>

          <div className={styles.btnGroupFull}>
            <button
              className={`btn btn-primary ${styles.startBtn}`}
              onClick={() => navigate('/matching')}
            >
              ⚡ 추천 분야로 매칭 신청하기 ⚡
            </button>
            <button
              className={`btn btn-outline ${styles.reTestBtn}`}
              onClick={() => { setResult(null); setAnswers({}); setCurrentIndex(0); setIsStarted(false); }}
            >
              🔄 다시 검사하기
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 💡 1. 검사 시작 전 소개 안내 화면
  if (!isStarted) {
    return (
      <div className={styles.container}>
        <div className={`glass-card ${styles.introCard}`}>
          <div className={styles.topBar}>
            <button type="button" className={styles.backBtn} onClick={() => navigate('/home?tab=matching')}>← 메인화면</button>
          </div>
          <div className={styles.introIconBadge}>🌱</div>
          <h1 className={styles.introTitle}>맞춤 적성검사 안내</h1>
          <p className={styles.introDesc}>
            왜 적성검사를 진행하나요? 🤔
          </p>

          <div className={styles.introFeatureList}>
            <div className={styles.introFeatureItem}>
              <span className={styles.featureEmoji}>🤖</span>
              <div>
                <strong>AI 정밀 스탯 분석</strong>
                <p>내 체력·근력·성향을 종합 분석하여 스탯 카드로 정밀 수치화해 드립니다.</p>
              </div>
            </div>
            <div className={styles.introFeatureItem}>
              <span className={styles.featureEmoji}>🌾</span>
              <div>
                <strong>나에게 딱 맞는 농가 일자리 추천</strong>
                <p>내가 힘들어하지 않고 재밌게 수행할 수 있는 맞춤 소일거리를 정확하게 찾아드립니다.</p>
              </div>
            </div>
            <div className={styles.introFeatureItem}>
              <span className={styles.featureEmoji}>⏱️</span>
              <div>
                <strong>1분 내외의 가벼운 검사</strong>
                <p>솔직하게 '예/아니요'로 답변해주시면 즉시 분석이 완료됩니다.</p>
              </div>
            </div>
          </div>

          <button
            className={`btn btn-primary ${styles.startBtn}`}
            onClick={() => setIsStarted(true)}
          >
            🌱 적성검사 시작하기 (1분 소요)
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
      <div className={styles.topBar}>
        <button type="button" className={styles.backBtn} onClick={() => navigate('/home?tab=matching')}>← 메인화면</button>
      </div>
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