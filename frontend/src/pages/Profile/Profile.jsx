import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../store/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import { authAPI, matchingAPI } from '../../api'
import { useToast } from '../../context/ToastContext'
import StatHexagon from '../../components/StatHexagon'
import styles from './Profile.module.css'

// [피드백 반영] 농업 특화 스텟 라벨 (컬럼명은 기존 그대로 유지, 표시 이름만 구체화)
const STAT_DISPLAY = [
  { field: 'stamina', label: '체력', icon: '⚡' },
  { field: 'strength', label: '근력', icon: '💪' },
  { field: 'intelligence', label: '숙련도', icon: '🧠' },
  { field: 'grit', label: '성실성', icon: '🔥' },
  { field: 'personality', label: '협동심', icon: '🤝' },
  { field: 'wage_pref', label: '급여민감도', icon: '💰' },
]

const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function Profile() {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const isFarmer = user?.role === '농부'
  const isStatsEmpty = (u) =>
    !u?.strength && !u?.stamina && !u?.grit && !u?.intelligence &&
    !u?.wage_pref && !u?.personality

  const [recommendedTask, setRecommendedTask] = useState(null)
  const photoInputRef = useRef(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // 🌾 [피드백 반영] 직업(청년) 배지 바로 옆에 표시할 AI 추천 업무 조회
  useEffect(() => {
    if (!user || isFarmer || isStatsEmpty(user)) {
      setRecommendedTask(null)
      return
    }
    matchingAPI.getRecommendedTasks(1)
      .then((res) => setRecommendedTask(res.data?.[0]?.task || null))
      .catch((err) => {
        console.error('추천 업무 조회 실패:', err)
        setRecommendedTask(null)
      })
  }, [user?.id, user?.strength, user?.stamina, user?.grit, user?.intelligence, user?.wage_pref, user?.personality, isFarmer])

  // 🖼️ [피드백 반영] 프로필 사진 업로드 (2~5MB 이하)
  const handleClickAvatar = () => {
    if (uploadingPhoto) return
    photoInputRef.current?.click()
  }

  const handlePhotoSelected = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!ALLOWED_PROFILE_IMAGE_TYPES.includes(file.type)) {
      showToast('JPEG, PNG, WEBP 형식의 이미지만 등록할 수 있어요.', 'error')
      return
    }
    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      showToast('프로필 사진은 5MB를 넘을 수 없어요.', 'error')
      return
    }

    setUploadingPhoto(true)
    try {
      await authAPI.uploadProfileImage(file)
      await refreshUser()
      showToast('프로필 사진이 등록되었습니다! 🖼️', 'success')
    } catch (err) {
      showToast('프로필 사진 업로드 실패: ' + (err.response?.data?.detail || '오류가 발생했습니다.'), 'error')
    } finally {
      setUploadingPhoto(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      {/* 배경 */}
      <div className={styles.bgOrb} />

      {/* 상단 헤더 */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link to="/home" className={styles.backBtn}>← 홈으로</Link>
        </div>
        <h1 className={styles.headerTitle}>내 개인정보</h1>
        <button className={styles.logoutBtn} onClick={handleLogout}>로그아웃</button>
      </header>

      <main className={styles.main}>
        {/* 프로필 카드 상단 */}
        <section className={`glass-card ${styles.userMainCard}`}>
          {/* 🖼️ [피드백 반영] 프로필 사진 등록 */}
          <div
            className={styles.avatarArea}
            onClick={handleClickAvatar}
            role="button"
            title="프로필 사진 등록/변경"
          >
            {user?.profile_image ? (
              <img src={user.profile_image} alt="프로필 사진" className={styles.avatarImg} />
            ) : (
              <span className={styles.avatarEmoji}>
                {user?.role === '농부' ? '👨‍🌾' : '🌱'}
              </span>
            )}
            <span className={styles.avatarEditBadge}>{uploadingPhoto ? '⏳' : '📷'}</span>
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handlePhotoSelected}
          />

          <h2 className={styles.userName}>{user?.name}</h2>
          <div className={styles.roleTaskRow}>
            <span className={styles.userRoleTag}>{user?.role}</span>
            {/* 🌾 [피드백 반영] 직업(청년) 바로 오른쪽에 AI 추천 업무 표시 */}
            {!isFarmer && (
              <span className={styles.recommendedTaskTag}>
                {recommendedTask ? `✨ 추천업무: ${recommendedTask}` : '적성검사 필요'}
              </span>
            )}
          </div>
          <div className={styles.ratingBox}>
            <span>⭐ 평점</span>
            <strong>{user?.rating ? Number(user?.rating).toFixed(1) : '0.0'} / 5.0</strong>
          </div>
        </section>

        {/* 기본 계정 정보 */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>📋 기본 계정 정보</h3>
          <div className={`glass-card ${styles.infoCard}`}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>이름</span>
              <span className={styles.infoValue}>{user?.name}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>이메일</span>
              <span className={styles.infoValue}>{user?.email}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>회원 유형</span>
              <span className={styles.infoValue}>{user?.role}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>거주 지역</span>
              <span className={styles.infoValue}>{user?.location || '미설정'}</span>
            </div>
          </div>
        </section>

        {/* 스탯 정보 - 육각형 지표 + 숫자 지표를 함께 표시 */}
        {!isFarmer && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>📊 내 매칭 스탯</h3>
            <div className={`glass-card ${styles.statsRow}`}>
              {/* 🔷 [피드백 반영] 왼쪽: 육각형 지표 (스텟이 0이어도 작은 육각형이 보임) */}
              <StatHexagon
                items={STAT_DISPLAY.map((s) => ({ label: s.label, value: user?.[s.field] ?? 0 }))}
              />
              {/* 🔢 오른쪽: 숫자 지표 */}
              <div className={styles.statsNumeric}>
                {STAT_DISPLAY.map((s) => (
                  <div key={s.field} className={styles.statBox}>
                    <span className={styles.statIcon}>{s.icon}</span>
                    <span className={styles.statName}>{s.label}</span>
                    <strong className={styles.statVal}>{user?.[s.field] ?? 0}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
