import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './About.module.css'
import avatarYouth from '../../assets/icons/avatar_youth.png'
import avatarFarmer from '../../assets/icons/avatar_farmer.png'
import mascotSoilyi from '../../assets/icons/character_soilyi.png'
import chungjuFarmImg from '../../assets/icons/chungju_farm.jpg'
import koreaMapImg from '../../assets/icons/korea_map_chungju.png'
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  MapPin,
  Heart,
  Sprout,
  Users,
  Trophy,
  ArrowRight,
  Compass,
  CheckCircle2
} from 'lucide-react'

const PAGES = [
  {
    step: 1,
    tag: '기획 배경 & 탄생 스토리',
    title: '왜 충주에서 ‘소일거리’가 시작되었을까요?',
    desc: '충청북도 충주는 청정한 자연과 풍요로운 과수·농산물의 본고장이지만, 매년 수확철마다 일손 부족이라는 깊은 고민을 안고 있었습니다. 반면 전국의 수많은 청년들은 복잡한 도시를 벗어나 힐링과 실속 있는 보람을 찾고 있습니다.',
    highlight: '이 두 연결점을 AI 기술로 잇고자 탄생한 플랫폼이 바로 「소일거리」입니다.',
    type: 'story',
  },
  {
    step: 2,
    tag: '전국 ➡️ 충주 도농 융합',
    title: '전국의 열정 넘치는 청년들이 충주로 모입니다',
    desc: '서울, 경기, 부산, 대구 등 전국 각지에서 모인 청년들이 내 적성과 역량에 꼭 맞는 충주의 소일거리를 찾아 충주 농가로 이동하고 있습니다.',
    highlight: '이동 거리와 선호 업무, 일손 역량을 실시간으로 분석하여 최적의 이동 동선과 매칭을 제공합니다.',
    type: 'map',
  },
  {
    step: 3,
    tag: '농가 일손 돕기 & 지역 활성화',
    title: '청년과 농부의 따뜻한 상생과 지역의 활기',
    desc: '청년은 땀 흘려 일하는 농촌의 가치를 배우고 정당한 보상과 풍성한 힐링을 얻으며, 농가는 가장 든든하고 성실한 청년 일손을 지원받아 풍년의 기쁨을 누립니다.',
    highlight: '단순한 단기 알바를 넘어, 충주 농촌의 지속 가능한 성장과 활기찬 도농 상생을 실현합니다.',
    type: 'collaboration',
  },
  {
    step: 4,
    tag: '소일이와 함께 시작하기',
    title: '충북 소일거리의 든든한 안내원 ‘소일이’와 함께해요!',
    desc: '처음이어도 걱정하지 마세요. 1분 맞춤 적성검사부터 1:1 대화방 조율, 활동 완료 후 신뢰 레벨업까지 똑똑한 소일이가 모든 여정을 함께합니다.',
    highlight: '지금 바로 소일거리와 함께 기분 좋은 농촌 라이프를 시작해 보세요!',
    type: 'start',
  }
]

export default function About() {
  const navigate = useNavigate()
  const [currentPage, setCurrentPage] = useState(0)

  const page = PAGES[currentPage]

  const handleNext = () => {
    if (currentPage < PAGES.length - 1) {
      setCurrentPage((prev) => prev + 1)
    } else {
      navigate('/home')
    }
  }

  const handlePrev = () => {
    if (currentPage > 0) {
      setCurrentPage((prev) => prev - 1)
    }
  }

  return (
    <div className={styles.wrapper}>
      {/* 상단 네비게이션 헤더 */}
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/home')} title="홈으로 돌아가기">
          <ChevronLeft size={20} strokeWidth={2.4} />
          <span>홈으로</span>
        </button>
        <h1 className={styles.headerTitle}>소일거리란?</h1>
        <div style={{ width: '60px' }} />
      </header>

      <main className={styles.main}>
        {/* 상단 단계 인디케이터 */}
        <div className={styles.stepIndicatorRow}>
          {PAGES.map((p, idx) => (
            <button
              key={p.step}
              className={`${styles.stepDotBtn} ${idx === currentPage ? styles.stepDotActive : idx < currentPage ? styles.stepDotPassed : ''}`}
              onClick={() => setCurrentPage(idx)}
            >
              <span className={styles.stepDotNumber}>{p.step}</span>
              <span className={styles.stepDotLabel}>STEP {p.step}</span>
            </button>
          ))}
        </div>

        {/* 메인 비주얼 카드 */}
        <div className={`glass-card ${styles.contentCard}`}>
          <div className={styles.tagBadge}>
            <Sparkles size={14} color="#E6A800" strokeWidth={2.2} />
            <span>{page.tag}</span>
          </div>

          {/* 🌟 1페이지 비주얼: 충주시 공식 CI 로고 & 마스코트 소일이 */}
          {page.type === 'story' && (
            <div className={styles.visualBox}>
              <div className={styles.chungjuEmblemWrapper}>
                {/* 🏛️ 충주시 공식 CI 로고 디자인 */}
                <div className={styles.chungjuLogoCard}>
                  <div className={styles.chungjuCiMark}>
                    {/* 충주시 공식 심볼 마크: 남한강의 맑은 물결과 충주 사과·산천을 상징하는 역동적 3원색 그래픽 */}
                    <svg width="46" height="46" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="50" cy="50" r="46" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />
                      {/* 푸른 남한강 물결 */}
                      <path d="M22 62C32 54 44 68 56 60C68 52 78 62 82 58" stroke="#0284C7" strokeWidth="7" strokeLinecap="round" />
                      {/* 충주 청정 산천 (그린) */}
                      <path d="M28 50C38 42 48 54 60 46C70 40 76 46 80 44" stroke="#16A34A" strokeWidth="6" strokeLinecap="round" />
                      {/* 충주 사과 / 떠오르는 태양 (레드&오렌지) */}
                      <circle cx="62" cy="34" r="14" fill="#E11D48" />
                      <path d="M62 20C62 16 66 14 68 12" stroke="#15803D" strokeWidth="3.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className={styles.chungjuCiTextGroup}>
                    <span className={styles.chungjuCiSub}>더 가까이, 대한민국 중심</span>
                    <span className={styles.chungjuCiMain}>충주시 <strong className={styles.ciEng}>CHUNGJU</strong></span>
                  </div>
                </div>

                <div className={styles.heartConnector}>
                  <Heart size={22} color="#E11D48" fill="#FDA4AF" />
                </div>

                <div className={styles.mascotCircleArea}>
                  <img src={mascotSoilyi} alt="소일이" className={styles.storyMascotImg} />
                  <span className={styles.mascotNameBadge}>소일이</span>
                </div>
              </div>
            </div>
          )}

          {/* 🌟 2페이지 비주얼: 전국 지도 (충주 중심 강조) 실사 지도 */}
          {page.type === 'map' && (
            <div className={styles.visualBox} style={{ minHeight: '240px', padding: 0 }}>
              <div className={styles.mapPhotoScene}>
                {/* 🗺️ 유저 제공 전국 지도 (충주시 및 붉은색 핀 강조) */}
                <img src={koreaMapImg} alt="대한민국 전국 지도 충주시" className={styles.koreaMapBgImg} />

                {/* 출발지 노드 뱃지 */}
                <div className={`${styles.cityNode} ${styles.nodeSeoul}`}>
                  <span className={styles.cityPulse} />
                  <span className={styles.cityName}>서울·수도권</span>
                </div>
                <div className={`${styles.cityNode} ${styles.nodeGangwon}`}>
                  <span className={styles.cityPulse} />
                  <span className={styles.cityName}>강원권</span>
                </div>
                <div className={`${styles.cityNode} ${styles.nodeGyeongsang}`}>
                  <span className={styles.cityPulse} />
                  <span className={styles.cityName}>영남권</span>
                </div>
                <div className={`${styles.cityNode} ${styles.nodeJeolla}`}>
                  <span className={styles.cityPulse} />
                  <span className={styles.cityName}>호남권</span>
                </div>

                {/* 전국 ➔ 충주시 붉은 핀으로 모여드는 청년 아바타 3개 스트림 */}
                <div className={styles.movingYouthStream}>
                  <div className={`${styles.flyingYouth} ${styles.fly1}`} title="수도권 ➔ 충주">
                    <img src={avatarYouth} alt="청년" />
                  </div>
                  <div className={`${styles.flyingYouth} ${styles.fly2}`} title="호남권 ➔ 충주">
                    <img src={avatarYouth} alt="청년" />
                  </div>
                  <div className={`${styles.flyingYouth} ${styles.fly3}`} title="영남권 ➔ 충주">
                    <img src={avatarYouth} alt="청년" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 🌟 3페이지 비주얼: 실제 충주 논밭·과수원 풍경 배경 속 청년과 농부의 협력 */}
          {page.type === 'collaboration' && (
            <div className={styles.visualBox} style={{ minHeight: '220px', padding: 0 }}>
              <div className={styles.collabSceneWithPhoto}>
                {/* 🌾 충주 논밭/농촌 실제 풍경 배경 이미지 */}
                <img src={chungjuFarmImg} alt="충주 농촌 들녘" className={styles.chungjuFarmBgPhoto} />
                <div className={styles.chungjuFarmPhotoOverlay} />

                {/* 청년 & 농부 상생 아바타 플로팅 카드 */}
                <div className={styles.collabFloatingLayer}>
                  <div className={styles.collabGlassCard}>
                    <div className={styles.collabAvatarRing}>
                      <img src={avatarYouth} alt="청년" />
                    </div>
                    <strong>소일거리 청년</strong>
                    <span>성실한 일손 & 힐링</span>
                  </div>

                  <div className={styles.collabHandshakeIcon}>
                    <div className={styles.handshakePulse}>🤝</div>
                    <span className={styles.handshakeLabel}>도농 상생</span>
                  </div>

                  <div className={styles.collabGlassCard}>
                    <div className={styles.collabAvatarRing}>
                      <img src={avatarFarmer} alt="농부" />
                    </div>
                    <strong>충주 농가</strong>
                    <span>풍년 결실 & 일손 든든</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 🌟 4페이지 비주얼: 소일이와 함께 시작하는 온보딩 */}
          {page.type === 'start' && (
            <div className={styles.visualBox}>
              <div className={styles.startScene}>
                <div className={styles.startMascotHero}>
                  <div className={styles.startGlowRing} />
                  <img src={mascotSoilyi} alt="소일이" className={styles.startMascotImg} />
                </div>
                <div className={styles.startFeatureGrid}>
                  <div className={styles.startFeatureItem}>
                    <CheckCircle2 size={16} color="#16A34A" />
                    <span>1분 맞춤 적성검사</span>
                  </div>
                  <div className={styles.startFeatureItem}>
                    <CheckCircle2 size={16} color="#16A34A" />
                    <span>AI 최적 추천 점수</span>
                  </div>
                  <div className={styles.startFeatureItem}>
                    <CheckCircle2 size={16} color="#16A34A" />
                    <span>안전한 1:1 실시간 조율</span>
                  </div>
                  <div className={styles.startFeatureItem}>
                    <CheckCircle2 size={16} color="#16A34A" />
                    <span>투명한 상호 리뷰 & 성장</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 텍스트 컨텐츠 영역 */}
          <div className={styles.textContentArea}>
            <h2 className={styles.pageTitle}>{page.title}</h2>
            <p className={styles.pageDesc}>{page.desc}</p>
            <div className={styles.highlightBox}>
              <p>{page.highlight}</p>
            </div>
          </div>
        </div>

        {/* 하단 페이지네이션 버튼 바 */}
        <div className={styles.bottomActionBar}>
          {currentPage > 0 ? (
            <button className={`btn btn-outline ${styles.navBtnPrev}`} onClick={handlePrev}>
              <ChevronLeft size={18} strokeWidth={2.4} />
              <span>이전</span>
            </button>
          ) : (
            <div style={{ flex: 1 }} />
          )}

          <button className={`btn btn-primary ${styles.navBtnNext}`} onClick={handleNext}>
            <span>{currentPage === PAGES.length - 1 ? '소일거리 시작하기' : '다음 이야기'}</span>
            {currentPage === PAGES.length - 1 ? (
              <Compass size={18} strokeWidth={2.4} />
            ) : (
              <ChevronRight size={18} strokeWidth={2.4} />
            )}
          </button>
        </div>
      </main>
    </div>
  )
}
