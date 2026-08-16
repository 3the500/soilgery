import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { aptitudeAPI, matchingAPI } from '../../api/index'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../context/ToastContext'
import StatHexagon from '../../components/StatHexagon'
import styles from './Aptitude.module.css'
import mascotSoilyi from '../../assets/icons/character_soilyi.png'
import {
  Sparkles,
  Sprout,
  Clock,
  Brain,
  CheckCircle2,
  HelpCircle,
  RotateCcw
} from 'lucide-react'

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

  // 🛡️ [버그 수정] "다음" 버튼 위치가 마지막 문항에서 "결과 제출하기"로 바뀌는 순간,
  // 일부 안드로이드 웹뷰(APK)에서 같은 좌표에 남아있는 터치 이벤트가 새로 렌더링된
  // 제출 버튼까지 눌러버리는 '고스트 클릭' 현상이 있어, 문항 전환 직후 아주 짧은 시간
  // 동안은 제출 버튼이 눌리지 않도록 잠가둔다.
  const [justArrived, setJustArrived] = useState(false)

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
      const goingToLast = currentIndex + 1 === questions.length - 1
      if (goingToLast) {
        // 마지막 문항으로 이동하는 순간 = 같은 자리 버튼이 "제출"로 바뀌는 순간
        setJustArrived(true)
        setTimeout(() => setJustArrived(false), 400)
      }
      setCurrentIndex((prev) => prev + 1)
    }
  }

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    // 🛡️ [버그 수정] 문항 전환 직후 짧은 잠금 시간 동안 들어온 제출 이벤트는
    // 사용자가 실제로 누른 게 아니라 고스트 클릭일 가능성이 높으므로 무시한다.
    if (justArrived) {
      return
    }
    // 🚨 [피드백 반영] "결과 제출하기" 버튼을 눌렀을 때만(다른 질문 이동 시점이 아니라)
    // 모든 문항이 체크되어 있는지 확인하고, 빠진 문항이 있으면 alert 팝업으로 안내한다.
    if (!allAnswered) {
      alert('아직 체크하지 않은 문항이 있어요! 모든 문항에 답변해주세요.')
      return
    }
    setLoading(true)
    try {
      const res = await aptitudeAPI.submitTest({ answers })
      setResult(res.data)
      await refreshUser?.()
      showToast('적성검사가 완료되었습니다! 일손 역량 지표가 업데이트되었어요. 🎉', 'success')

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

  const getRecommendedTaskName = (resObj) => {
    if (!resObj) return '과수원 수확 및 농사 작업'
    const { intelligence = 0, strength = 0, stamina = 0 } = resObj
    if (intelligence >= strength && intelligence >= stamina) {
      return '농기구 운용'
    } else if (strength >= stamina) {
      return '물건 나르기 & 농작물 운반'
    } else {
      return '밭일 & 과수원 수확 작업'
    }
  }

  if (result) {
    const recommendedTask = recommended?.task || getRecommendedTaskName(result)
    const recommendedDesc = recommended?.message
    const aiReason = recommended?.ai_reason

    const statData = {
      strength: result.strength ?? user?.strength ?? 0,
      stamina: result.stamina ?? user?.stamina ?? 0,
      grit: result.grit ?? user?.grit ?? 0,
      intelligence: result.intelligence ?? user?.intelligence ?? 0,
      personality: result.personality ?? user?.personality ?? 0,
      wage_pref: result.wage_pref ?? user?.wage_pref ?? 0,
    }

    const STAT_KEYS = [
      { key: 'stamina', label: '⚡ 체력' },
      { key: 'strength', label: '💪 근력' },
      { key: 'grit', label: '🔥 성실성' },
      { key: 'intelligence', label: '🧠 숙련도' },
      { key: 'personality', label: '🤝 협동심' },
      { key: 'wage_pref', label: '💰 급여민감도' },
    ]

    return (
      <div className={styles.wrapper}>
        <div className={styles.bgOrb} />
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button type="button" className={styles.backBtn} onClick={() => navigate('/home?tab=matching')}>
              ← 홈으로
            </button>
          </div>
          <h1 className={styles.headerTitle}>🌱 적성검사 결과</h1>
          <div className={styles.headerRight}>
            <span className={styles.stepBadge}>분석 완료</span>
          </div>
        </header>

        <div className={styles.container}>
          <div className={`glass-card ${styles.resultMainCard}`}>
            <div className={styles.resultHeader}>
              <span className={styles.resultBadge}>ANALYSIS COMPLETE</span>
              <h2 className={styles.resultTitle}>🎉 나의 농업 일손 역량 분석 완료!</h2>
              <p className={styles.resultDesc}>
                나의 성향과 체력을 종합 분석한 6대 핵심 역량 결과표입니다.
              </p>
            </div>

            {/* 📊 육각형 레이더 스탯 차트 */}
            <div className={styles.statHexagonWrapper}>
              <StatHexagon stats={statData} size={280} />
            </div>

            {/* 6개 스탯 점수 상세 그리드 */}
            <div className={styles.statGrid}>
              {STAT_KEYS.map(({ key, label }) => (
                <div key={key} className={styles.statItem}>
                  <span className={styles.statLabel}>{label}</span>
                  <span className={styles.statValue}>{statData[key]}점</span>
                </div>
              ))}
            </div>

            {/* 💡 추천 분야 안내 카드 */}
            <div className={styles.recommendNoticeBox}>
              <span className={styles.recommendBadge}>✨ AI 1순위 추천 농사 분야</span>
              <h3 className={styles.recommendTaskTitle}>{recommendedTask}</h3>
              <p className={styles.recommendTaskDesc}>
                {recommendedDesc || (
                  <>나의 일손 성향과 체력을 고려해 보았을 때 <strong>{recommendedTask}</strong> 분야에 가장 높은 적합도를 보였습니다. 추천해 드린 이 분야로 맞춤 일손 매칭을 시작하실 수 있습니다!</>
                )}
              </p>

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
      </div>
    )
  }

  if (!isStarted) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.bgOrb} />
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button type="button" className={styles.backBtn} onClick={() => navigate('/home?tab=matching')}>
              ← 홈으로
            </button>
          </div>
          <h1 className={styles.headerTitle}>🌱 맞춤 적성검사</h1>
          <div className={styles.headerRight}>
            <span className={styles.stepBadge}>소개</span>
          </div>
        </header>

        <div className={styles.container}>
          <div className={`glass-card ${styles.introCard}`}>
            <div className={styles.introIconBadge}>
              <img src={mascotSoilyi} alt="소일이" style={{ width: '64px', height: '64px', objectFit: 'contain', mixBlendMode: 'multiply' }} />
            </div>
            <h1 className={styles.introTitle}>맞춤 적성검사 안내</h1>
            <p className={styles.introDesc}>
              왜 적성검사를 진행하나요? 🤔
            </p>

            <div className={styles.introFeatureList}>
              <div className={styles.introFeatureItem}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#EBF4FA',
                  border: '1.5px solid #BFDBFE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Brain size={20} color="#2563EB" strokeWidth={2.2} />
                </div>
                <div>
                  <strong>내 일손 역량 맞춤 분석</strong>
                  <p>내 체력·근력·성향을 종합 분석하여 일손 역량 지표로 측정해 드립니다.</p>
                </div>
              </div>
              <div className={styles.introFeatureItem}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#EDF4EF',
                  border: '1.5px solid #A7F3D0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Sprout size={20} color="#224836" strokeWidth={2.2} />
                </div>
                <div>
                  <strong>나에게 딱 맞는 농가 일자리 추천</strong>
                  <p>내가 힘들어하지 않고 재밌게 수행할 수 있는 맞춤 소일거리를 정확하게 찾아드립니다.</p>
                </div>
              </div>
              <div className={styles.introFeatureItem}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#FEF3C7',
                  border: '1.5px solid #FCD34D',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Clock size={20} color="#D97706" strokeWidth={2.2} />
                </div>
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
      </div>
    )
  }

  const currentQuestion = questions[currentIndex]
  const isFirst = currentIndex === 0
  const isLast = questions.length > 0 && currentIndex === questions.length - 1

  return (
    <div className={styles.wrapper}>
      <div className={styles.bgOrb} />
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button type="button" className={styles.backBtn} onClick={() => navigate('/home?tab=matching')}>
            ← 홈으로
          </button>
        </div>
        <h1 className={styles.headerTitle}>🌱 적성검사 진행</h1>
        <div className={styles.headerRight}>
          <span className={styles.stepBadge}>
            {currentIndex + 1} / {questions.length}
          </span>
        </div>
      </header>

      {/* 진행 바 */}
      {questions.length > 0 && (
        <div className={styles.progressBarTrack}>
          <div
            className={styles.progressBarFill}
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>
      )}

      <div className={styles.container}>
        {loadError && <p style={{ color: '#ff6b6b', textAlign: 'center' }}>{loadError}</p>}

        {questions.length > 0 && currentQuestion && (
          <form onSubmit={handleSubmit} className={styles.questionForm}>
            <div className={styles.questionCard}>
              <div className={styles.questionBadgeRow}>
                <span className={styles.questionNumberBadge}>질문 {currentIndex + 1}</span>
              </div>
              <p className={styles.questionText}>
                {currentQuestion.text}
              </p>

              <div className={styles.optionsGroup}>
                {OPTIONS.map((opt) => (
                  <label
                    key={opt}
                    className={`${styles.optionLabel} ${
                      answers[currentQuestion.id] === opt ? styles.optionLabelActive : ''
                    }`}
                  >
                    <input
                      type="radio"
                      className={styles.radioInput}
                      name={`q_${currentQuestion.id}`}
                      checked={answers[currentQuestion.id] === opt}
                      onChange={() => handleSelect(currentQuestion.id, opt)}
                    />
                    <span className={styles.optionRadioCustom}>
                      {answers[currentQuestion.id] === opt ? '●' : '○'}
                    </span>
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.btnGroup}>
              <div>
                {!isFirst && (
                  <button type="button" className={styles.navBtnPrev} onClick={handlePrev}>
                    ← 이전
                  </button>
                )}
              </div>

              <div>
                {!isLast ? (
                  <button type="button" className={styles.navBtnNext} onClick={handleNext}>
                    다음 →
                  </button>
                ) : (
                  <button type="submit" className={styles.submitBtn} disabled={loading || justArrived}>
                    {loading ? '분석 중...' : '🎉 결과 제출하기'}
                  </button>
                )}
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}