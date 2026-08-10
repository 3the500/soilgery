import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { aptitudeAPI, matchingAPI } from '../../api/index'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../context/ToastContext'
import styles from './Aptitude.module.css'

const OPTIONS = ['예', '아니요']

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

  // 🔍 [피드백 반영] 검사 완료 화면에서 보여줄 "1순위 추천 업무" 상세 정보
  // (task/message/ai_reason 은 매칭 화면과 동일하게 백엔드 계산 결과를 그대로 사용)
  const [recommended, setRecommended] = useState(null)
  const [showDetailReason, setShowDetailReason] = useState(false)

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
      showToast('적성검사가 완료되었습니다! 일손 역량 지표가 업데이트되었어요. 🎉', 'success')

      // 🔍 [피드백 반영] 매칭 화면과 동일한 기준(유클리드 거리)으로 계산된 1순위 추천
      // 업무 + AI 상세 분석 근거를 함께 조회해 결과 화면에서 바로 보여준다.
      try {
        const taskRes = await matchingAPI.getRecommendedTasks(1)
        setRecommended(taskRes.data?.[0] || null)
      } catch (taskErr) {
        console.error('추천 업무 상세 조회 실패:', taskErr)
        setRecommended(null)
      }
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
    // recommended(백엔드 계산 결과)를 우선 사용하고, 아직 못 받아왔거나 실패한 경우에만
    // 기존의 간단한 로컬 추정치로 대체 표시한다.
    const recommendedTask = recommended?.task || getRecommendedTaskName(result)
    const recommendedDesc = recommended?.message
    const aiReason = recommended?.ai_reason

    return (
      <div className={styles.container}>
        <div className={`glass-card ${styles.introCard}`}>
          <div className={styles.topBar}>
            <button type="button" className={styles.backBtn} onClick={() => navigate('/home?tab=matching')}>← 홈으로</button>
          </div>

          {/* 💡 추천 분야 안내 카드 */}
          <div className={styles.recommendNoticeBox}>
            <span className={styles.recommendBadge}>✨ 1순위 추천 농사 분야</span>
            <h3 className={styles.recommendTaskTitle}>{recommendedTask}</h3>
            <p className={styles.recommendTaskDesc}>
              {recommendedDesc || (
                <>나의 일손 성향과 체력을 고려해 보았을 때 <strong>{recommendedTask}</strong> 분야에 가장 높은 적합도를 보였습니다. 추천해 드린 이 분야로 맞춤 일손 매칭을 시작하실 수 있습니다!</>
              )}
            </p>

            {/* 🔍 [피드백 반영] AI가 왜 이렇게 분석했는지 "상세하게 보기" / "접기" 토글
                (매칭 화면에 있던 기능을 이 화면으로 이동) */}
            {aiReason && (
              <>
                <button
                  type="button"
                  className={styles.detailToggleBtn}
                  onClick={() => setShowDetailReason((prev) => !prev)}
                >
                  {showDetailReason ? '접기 ▲' : '🔍 AI 분석 상세하게 보기 ▼'}
                </button>
                {showDetailReason && (
                  <div className={styles.detailReasonBox}>
                    <p className={styles.detailReasonText}>{aiReason}</p>
                  </div>
                )}
              </>
            )}
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
              onClick={async () => {
                try {
                  await aptitudeAPI.resetStats()
                  await refreshUser?.()
                } catch (e) {
                  console.log('스텟 초기화 진행:', e)
                }
                setResult(null)
                setAnswers({})
                setCurrentIndex(0)
                setIsStarted(false)
                setRecommended(null)
                setShowDetailReason(false)
              }}
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
            <button type="button" className={styles.backBtn} onClick={() => navigate('/home?tab=matching')}>← 홈으로</button>
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
                <strong>내 일손 역량 맞춤 분석</strong>
                <p>내 체력·근력·성향을 종합 분석하여 일손 역량 지표로 측정해 드립니다.</p>
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
            onClick={async () => {
              try {
                await aptitudeAPI.resetStats()
                await refreshUser?.()
              } catch (e) {
                console.log('스텟 초기화 진행:', e)
              }
              setIsStarted(true)
            }}
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
        <button type="button" className={styles.backBtn} onClick={() => navigate('/home?tab=matching')}>← 홈으로</button>
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