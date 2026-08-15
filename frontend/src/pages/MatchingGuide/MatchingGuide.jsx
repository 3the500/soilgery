import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import styles from './MatchingGuide.module.css'

const STEPS = [
  {
    id: 0,
    tabLabel: '📌 전체 개요',
    badge: 'OVERVIEW',
    badgeIcon: '🌐',
    title: '소일거리 스마트 매칭 한눈에 보기',
    subTitle: 'AI 적성 분석부터 1:1 대화, 활동 완료 후 신뢰 레벨업까지 전 과정을 안내합니다.',
    isOverview: true,
    stepsSummary: [
      {
        num: '01',
        icon: '🌱',
        title: '맞춤 적성검사',
        desc: '6대 농업 역량 스탯 측정 및 나에게 꼭 맞는 농작업 도출',
        color: '#10B981',
      },
      {
        num: '02',
        icon: '⚡',
        title: '스마트 AI 매칭',
        desc: 'AI 분석 기반 최적 추천 점수 및 직무 맞춤 청년·농가 추천',
        color: '#F59E0B',
      },
      {
        num: '03',
        icon: '💬',
        title: '1:1 대화방 조율',
        desc: '매칭 즉시 전용 대화방 개설, 근무 일정·위치·준비물 협의',
        color: '#3B82F6',
      },
      {
        num: '04',
        icon: '⭐',
        title: '활동 & 신뢰 레벨업',
        desc: '상호 평점/리뷰 등록 및 경험치(EXP) 획득으로 성장',
        color: '#8B5CF6',
      },
    ],
    tips: [
      '💡 청년 회원은 적성검사를 1회 완료하시면 더욱 정밀한 AI 일자리 추천을 받을 수 있습니다.',
      '💡 농부 회원은 필요한 일손(밭일, 트랙터, 운반 등)을 선택하여 최우수 후보자를 바로 조회할 수 있습니다.',
    ],
  },
  {
    id: 1,
    tabLabel: '1단계 적성검사',
    badge: 'STEP 01',
    badgeIcon: '🌱',
    title: '1단계: 맞춤 적성검사 & 역량 분석',
    subTitle: '단 1분의 간단한 질문으로 나의 농업 강점을 정밀하게 파악합니다.',
    icon: '🌱',
    cardTitle: '나의 농업 육각형 스탯 완성',
    cardDesc: '체력, 근력, 성실성, 숙련도, 협동심, 급여민감도 6가지 요소를 종합 분석하여 최적의 농사 작업군(과수 수확, 밭일, 농기계 운용, 물건 운반 등)을 AI가 찾아냅니다.',
    features: [
      {
        icon: '⏱️',
        title: '1분 완성 초간단 검사',
        desc: '누구나 쉽게 응답할 수 있는 직관적인 질문들로 구성되어 있습니다.',
      },
      {
        icon: '📊',
        title: '실시간 레이더 스탯 차트',
        desc: '검사 직후 나의 역량 분포를 보기 쉬운 육각형 차트로 시각화합니다.',
      },
      {
        icon: '🎯',
        title: 'AI 1순위 추천 업무 도출',
        desc: '내 성향과 가장 궁합이 잘 맞는 대표 농사 작업을 자동 매핑합니다.',
      },
    ],
    hint: '📌 농부 회원은 적성검사 없이 필요한 업무만 선택하시면 바로 청년 후보자를 추천받으실 수 있습니다.',
  },
  {
    id: 2,
    tabLabel: '2단계 AI 매칭',
    badge: 'STEP 02',
    badgeIcon: '⚡',
    title: '2단계: 스마트 AI 매칭 & 추천 점수',
    subTitle: '작업 요구 조건과 청년의 역량을 비교하여 가장 높은 성사율의 매칭을 제공합니다.',
    icon: '⚡',
    cardTitle: '신뢰할 수 있는 AI 추천 점수',
    cardDesc: '농가의 작업 특성과 지원자의 적성 프로필 간 유클리드 거리 및 활동 이력을 정밀 연산하여 "AI 추천 점수"와 직관적인 추천 이유 태그를 함께 보여줍니다.',
    features: [
      {
        icon: '🥇',
        title: '최우수 추천 순위 뱃지',
        desc: '적합도 순으로 1위(최우수), 2위(우수), 3위 추천 뱃지가 부여되어 선택이 수월합니다.',
      },
      {
        icon: '🏷️',
        title: '핵심 추천 이유 한눈에 파악',
        desc: '🎯 직무 적합 최적!, ⚡ 즉시 투입 가능!, 🌟 평점 최상위! 등 핵심 강점을 즉시 확인합니다.',
      },
      {
        icon: '📍',
        title: '거리 및 프로필 투명 공개',
        desc: '거주 지역, 평점, 숙련도 레벨, 프로필 사진을 투명하게 확인 후 결정할 수 있습니다.',
      },
    ],
    hint: '📌 [이 청년과 매칭하기] 버튼을 누르면 상대방과의 1:1 대화방이 즉시 안전하게 생성됩니다.',
  },
  {
    id: 3,
    tabLabel: '3단계 대화 조율',
    badge: 'STEP 03',
    badgeIcon: '💬',
    title: '3단계: 1:1 전용 대화방 & 작업 조율',
    subTitle: '개설된 채팅방에서 편안하게 일손 조건과 세부 일정을 상의하세요.',
    icon: '💬',
    cardTitle: '안전하고 신속한 실시간 소통',
    cardDesc: '전화번호나 개인 메신저 노출 없이, 소일거리 내 전용 대화방에서 작업 일시, 집결 장소, 식사 및 안전 장구 등을 자유롭게 문의하고 약속을 확정합니다.',
    features: [
      {
        icon: '📅',
        title: '작업 일정 및 시간 약속',
        desc: '몇 시에 모이고 몇 시에 작업을 마칠지 구체적인 일정을 협의합니다.',
      },
      {
        icon: '🚗',
        title: '이동 경로 및 준비물 체크',
        desc: '농장 위치, 교통편, 장화나 장갑 등 준비물에 대해 미리 안내받습니다.',
      },
      {
        icon: '🔒',
        title: '안전한 플랫폼 내 소통',
        desc: '필요 시 언제든 대화방 목록에서 다시 확인하거나 대화를 이어나갈 수 있습니다.',
      },
    ],
    hint: '📌 약속이 확정되면 정해진 날짜에 즐겁고 안전하게 농가 일손을 돕고 보람을 느껴보세요!',
  },
  {
    id: 4,
    tabLabel: '4단계 리뷰·레벨업',
    badge: 'STEP 04',
    badgeIcon: '⭐',
    title: '4단계: 일손 활동 & 신뢰 리뷰 · 레벨업',
    subTitle: '활동을 마친 후 상호 평가를 남기고 경험치를 쌓아 최고의 일손으로 성장하세요.',
    icon: '⭐',
    cardTitle: '신뢰가 쌓이는 상호 평가 & 성장 시스템',
    cardDesc: '농작업이 완료되면 청년과 농부 모두 별점(1.0~5.0)과 따뜻한 후기를 등록할 수 있습니다. 성실한 활동마다 경험치(EXP)가 지급되어 레벨이 상승합니다.',
    features: [
      {
        icon: '⭐',
        title: '투명한 5성 상호 리뷰',
        desc: '약속 준수와 성실한 작업에 대한 솔직한 후기가 쌓여 서로의 신뢰 자산이 됩니다.',
      },
      {
        icon: '🏆',
        title: 'Lv.1 ~ Lv.10 소일거리 랭킹',
        desc: '새싹 소일꾼부터 전설의 일손, 농사의 신까지 레벨업하며 성취감을 얻습니다.',
      },
      {
        icon: '🌾',
        title: '수확 지수 & 우수 회원 혜택',
        desc: '높은 평점과 성실도를 유지할수록 AI 추천 목록 상단에 우선 노출됩니다.',
      },
    ],
    hint: '📌 성실하게 활동할수록 더 많은 농가와 청년들에게 신뢰받는 최고의 파트너가 됩니다!',
  },
]

export default function MatchingGuide() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)

  const isFarmer = user?.role === '농부'
  const activeData = STEPS[currentStep]
  const totalSteps = STEPS.length

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleGoMatching = () => {
    navigate('/matching')
  }

  return (
    <div className={styles.wrapper}>
      {/* 배경 장식 */}
      <div className={styles.bgOrb} />

      {/* 상단 헤더 */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => navigate('/home?tab=matching')}
          >
            ← 홈으로
          </button>
        </div>
        <h1 className={styles.headerTitle}>📖 소일거리 매칭 가이드</h1>
        <div className={styles.headerRight}>
          <span className={styles.stepCounterBadge}>
            {currentStep === 0 ? '개요' : `${currentStep} / ${totalSteps - 1} 단계`}
          </span>
        </div>
      </header>

      {/* 진행 바 (Progress Bar) */}
      <div className={styles.progressBarTrack}>
        <div
          className={styles.progressBarFill}
          style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
        />
      </div>

      {/* 단계별 탭 칩 네비게이션 */}
      <div className={styles.stepTabScroll}>
        <div className={styles.stepTabGroup}>
          {STEPS.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              className={`${styles.stepTabChip} ${
                currentStep === idx ? styles.stepTabChipActive : ''
              }`}
              onClick={() => {
                setCurrentStep(idx)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            >
              {s.tabLabel}
            </button>
          ))}
        </div>
      </div>

      {/* 메인 컨텐츠 영역 */}
      <main className={styles.mainContainer}>
        {/* 헤더 섹션 */}
        <section className={styles.stepHeaderSection}>
          <span className={styles.stepBadge}>
            {activeData.badgeIcon} {activeData.badge}
          </span>
          <h2 className={styles.stepMainTitle}>{activeData.title}</h2>
          <p className={styles.stepSubTitle}>{activeData.subTitle}</p>
        </section>

        {/* 0단계: 전체 개요 전용 뷰 */}
        {activeData.isOverview ? (
          <div className={styles.overviewSection}>
            <div className={styles.overviewGrid}>
              {activeData.stepsSummary.map((item) => (
                <div
                  key={item.num}
                  className={styles.overviewCard}
                  onClick={() => {
                    const stepNum = parseInt(item.num, 10)
                    setCurrentStep(stepNum)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  <div className={styles.overviewCardTop}>
                    <span className={styles.overviewNum}>{item.num}</span>
                    <span className={styles.overviewIcon}>{item.icon}</span>
                  </div>
                  <h3 className={styles.overviewCardTitle}>{item.title}</h3>
                  <p className={styles.overviewCardDesc}>{item.desc}</p>
                  <span className={styles.overviewCardArrow}>자세히 보기 →</span>
                </div>
              ))}
            </div>

            {/* 개요 팁 박스 */}
            <div className={styles.tipsContainer}>
              <h4 className={styles.tipsTitle}>💡 알아두면 유용한 팁</h4>
              <div className={styles.tipsList}>
                {activeData.tips.map((tip, idx) => (
                  <p key={idx} className={styles.tipItem}>
                    {tip}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* 1~4단계: 상세 단계별 뷰 */
          <div className={styles.detailStepSection}>
            {/* 핵심 카드 */}
            <div className={styles.mainHighlightCard}>
              <div className={styles.highlightHeader}>
                <span className={styles.highlightIcon}>{activeData.icon}</span>
                <div>
                  <h3 className={styles.highlightTitle}>{activeData.cardTitle}</h3>
                  <p className={styles.highlightDesc}>{activeData.cardDesc}</p>
                </div>
              </div>
            </div>

            {/* 주요 특징 3열 카드 */}
            <div className={styles.featuresList}>
              {activeData.features.map((feat, idx) => (
                <div key={idx} className={styles.featureItemCard}>
                  <div className={styles.featureItemIcon}>{feat.icon}</div>
                  <div className={styles.featureItemText}>
                    <strong className={styles.featureItemTitle}>{feat.title}</strong>
                    <p className={styles.featureItemDesc}>{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 하단 안내 힌트 바 */}
            {activeData.hint && (
              <div className={styles.stepHintBox}>
                <span className={styles.stepHintText}>{activeData.hint}</span>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 📱 하단 고정 플로팅 액션 바 (화살표 & 다음/이전 버튼) */}
      <footer className={styles.bottomActionBar}>
        <div className={styles.bottomActionInner}>
          {/* 이전 버튼 (1단계 이상일 때 표시) */}
          {currentStep > 0 ? (
            <button
              type="button"
              className={styles.prevBtn}
              onClick={handlePrev}
            >
              ← 이전 설명
            </button>
          ) : (
            <div className={styles.prevBtnPlaceholder} />
          )}

          {/* 스텝 닷 인디케이터 */}
          <div className={styles.dotIndicatorGroup}>
            {STEPS.map((_, idx) => (
              <span
                key={idx}
                className={`${styles.dotIndicator} ${
                  currentStep === idx ? styles.dotIndicatorActive : ''
                }`}
                onClick={() => {
                  setCurrentStep(idx)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              />
            ))}
          </div>

          {/* 우측 하단: 다음 버튼 (마지막 단계일 때는 매칭 시작 버튼) */}
          {currentStep < totalSteps - 1 ? (
            <button
              type="button"
              className={styles.nextBtn}
              onClick={handleNext}
            >
              다음 설명 →
            </button>
          ) : (
            <button
              type="button"
              className={styles.finishMatchBtn}
              onClick={handleGoMatching}
            >
              {isFarmer ? '🌾 청년 일손 찾기' : '🌱 소일거리 매칭 시작'}
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
