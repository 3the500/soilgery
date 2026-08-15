import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import api, { chatAPI, reviewAPI, API_BASE_URL } from '../../api/index'
import StatHexagon from '../../components/StatHexagon'
import styles from './Chat.module.css'
import avatarYouth from '../../assets/icons/avatar_youth.jpg'
import avatarFarmer from '../../assets/icons/avatar_farmer.jpg'

// 👤 [피드백 반영] 상대방 정보 보기 모달에 표시할 매칭 스탯 라벨
// (Profile.jsx의 STAT_DISPLAY와 동일한 항목/순서로 맞춰 통일감 있게 표시)
const PARTNER_STAT_DISPLAY = [
  { field: 'stamina', label: '체력', icon: '⚡' },
  { field: 'strength', label: '근력', icon: '💪' },
  { field: 'intelligence', label: '숙련도', icon: '🧠' },
  { field: 'grit', label: '성실성', icon: '🔥' },
  { field: 'personality', label: '협동심', icon: '🤝' },
  { field: 'wage_pref', label: '급여민감도', icon: '💰' },
]

// 🖼️🎬 [피드백 반영] 채팅 이미지/동영상 공유 - 서버(chat.py) 정책과 동일한 클라이언트 측 사전 검증
const MAX_IMAGE_BYTES = 20 * 1024 * 1024   // 이미지 20MB
const MAX_VIDEO_BYTES = 300 * 1024 * 1024  // 동영상 300MB
const toAttachmentUrl = (fileUrl) => (fileUrl ? `${API_BASE_URL}${fileUrl}` : '')

const toLocalDate = (isoString) => {
  if (!isoString) return null
  const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/.test(isoString)
  return new Date(hasTimezone ? isoString : `${isoString}Z`)
}

const formatKoreanTime = (isoString) => {
  const date = toLocalDate(isoString)
  if (!date) return ''
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Seoul',
  })
}

const formatKoreanDateHeader = (isoString) => {
  const date = toLocalDate(isoString)
  if (!date) return ''
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

// 📝 [피드백 반영] 상대방 리뷰 목록에 표시할 짧은 날짜 포맷 (YYYY.MM.DD)
const formatReviewDate = (isoString) => {
  const date = toLocalDate(isoString)
  if (!date) return ''
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

// ⚡ 인스타그램 DM 스타일 빠른 인사말 칩
const QUICK_REPLIES = [
  '👋 안녕하세요!',
  '📍 작업 위치가 어디인가요?',
  '⏰ 근무 시간 문의 드려요',
  '💰 시급 및 조건이 궁금해요',
]

export default function Chat() {
  const { matchId: paramMatchId } = useParams()
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()

  const [matchId, setMatchId] = useState(paramMatchId || null)
  const [messages, setMessages] = useState([])
  const [partner, setPartner] = useState(null)
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [leaving, setLeaving] = useState(false)

  // 👤 [피드백 반영] 채팅방에서 상대방 프로필 클릭 시 정보 보기 모달 제어 상태
  const [showPartnerInfoModal, setShowPartnerInfoModal] = useState(false)
  // 📊 [피드백 반영] 청년 상대방의 매칭 스탯은 "스탯보기" 버튼을 눌러야 펼쳐지도록 토글
  const [showPartnerStats, setShowPartnerStats] = useState(false)

  // 🥕 당근마켓 스타일 화면 중앙 커스텀 퇴장 & 평점 작성 모달 제어 상태
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [selectedRating, setSelectedRating] = useState(5.0)
  const [reviewComment, setReviewComment] = useState('')

  // 🖼️🎬 [피드백 반영] 이미지/동영상 첨부 업로드 상태
  const fileInputRef = useRef(null)
  const [uploadingFile, setUploadingFile] = useState(false)

  // 🚨 [피드백 반영] 채팅방 최초 입장 시 "캡처 후 신고" 안내 배너 노출 여부
  const [showReportNotice, setShowReportNotice] = useState(false)

  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchMessages = async (targetMatchId) => {
    if (!targetMatchId) return
    try {
      const res = await api.get(`/matches/${targetMatchId}/messages`)
      setMessages(res.data || [])
      setError('')
      localStorage.setItem('last_seen_chat_time', new Date().toISOString())
    } catch (err) {
      console.error('메시지 로딩 실패:', err)
      setError(err.response?.data?.detail || '채팅 내역을 불러오는데 실패했습니다.')
    }
  }

  const fetchPartnerInfo = async (targetMatchId) => {
    if (!targetMatchId) return
    try {
      const res = await chatAPI.getMatchInfo(targetMatchId)
      setPartner(res.data)
    } catch (err) {
      console.error('상대방 정보 조회 실패:', err)
    }
  }

  useEffect(() => {
    if (!user) return

    const currentMatchId = paramMatchId || matchId
    if (paramMatchId) {
      setMatchId(paramMatchId)
    }

    if (!currentMatchId) {
      setLoading(false)
      return
    }

    setLoading(true)
    fetchMessages(currentMatchId).finally(() => setLoading(false))
    fetchPartnerInfo(currentMatchId)

    // 🔴 [버그 수정] 메시지뿐 아니라 상대방 정보(퇴장 여부 partner_left 포함)도
    // 함께 폴링해야, 대화 중 상대방이 나갔을 때 "상대방이 나갔습니다" 알림이
    // 새로고침 없이 즉시 뜬다. (이전에는 메시지만 갱신되고 partner는 입장 시
    // 최초 1회만 조회되어 반영이 늦었음)
    const interval = setInterval(() => {
      fetchMessages(currentMatchId)
      fetchPartnerInfo(currentMatchId)
    }, 2000)

    return () => clearInterval(interval)
  }, [paramMatchId, matchId, user])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 🚨 [피드백 반영] 이 채팅방에 처음 입장했을 때만 "캡처 후 신고" 안내 배너를 노출
  useEffect(() => {
    if (!matchId) return
    const seenKey = `seen_report_notice_${matchId}`
    if (!localStorage.getItem(seenKey)) {
      setShowReportNotice(true)
    }
  }, [matchId])

  const handleDismissReportNotice = () => {
    if (matchId) {
      localStorage.setItem(`seen_report_notice_${matchId}`, '1')
    }
    setShowReportNotice(false)
  }

  const handleSendMessage = async (textToSend) => {
    const content = textToSend || inputText.trim()
    if (!content || !matchId) return

    if (!textToSend) {
      setInputText('')
    }

    try {
      const res = await api.post(`/matches/${matchId}/messages`, {
        content
      })
      setMessages((prev) => [...prev, res.data])
      localStorage.setItem('last_seen_chat_time', new Date().toISOString())
    } catch (err) {
      alert('메시지 전송 실패: ' + (err.response?.data?.detail || '오류가 발생했습니다.'))
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // 🖼️🎬 [피드백 반영] 이미지/동영상 첨부 전송 (이미지 20MB, 동영상 300MB 이하)
  const handleClickAttach = () => {
    if (uploadingFile || !matchId || partner?.partner_left) return
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !matchId) return

    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')

    if (!isImage && !isVideo) {
      alert('이미지 또는 동영상 파일만 전송할 수 있습니다.')
      return
    }
    if (isImage && file.size > MAX_IMAGE_BYTES) {
      alert('이미지 파일은 20MB를 초과할 수 없습니다.')
      return
    }
    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      alert('동영상 파일은 300MB를 초과할 수 없습니다.')
      return
    }

    setUploadingFile(true)
    try {
      const res = await chatAPI.uploadFile(matchId, file)
      setMessages((prev) => [...prev, res.data])
      localStorage.setItem('last_seen_chat_time', new Date().toISOString())
    } catch (err) {
      alert('파일 전송 실패: ' + (err.response?.data?.detail || '오류가 발생했습니다.'))
    } finally {
      setUploadingFile(false)
    }
  }

  // 🥕 당근마켓 스타일 모달에서 [평점 제출 & 나가기] 수행
  const confirmLeaveChatWithReview = async () => {
    if (!matchId || leaving) return
    setLeaving(true)
    setShowLeaveModal(false)

    try {
      // 1. 상대방 유저 ID가 있으면 리뷰 API 전송
      if (partner?.partner_id) {
        await reviewAPI.createReview({
          reviewee_id: partner.partner_id,
          match_id: Number(matchId),
          rating: selectedRating,
          comment: reviewComment.trim() || '소일거리 매칭 대화 후 퇴장하였습니다.'
        })
      }
    } catch (err) {
      console.error('리뷰 작성 처리 중 예외 (무시 후 나가기 진행):', err)
    }

    try {
      // 2. 채팅나가기 수행
      await chatAPI.leaveChat(matchId)
      await refreshUser?.()
      navigate('/home?tab=chat')
    } catch (err) {
      alert('채팅나가기 실패: ' + (err.response?.data?.detail || '오류가 발생했습니다.'))
      setLeaving(false)
    }
  }

  // 👋 [별점 없이 단순 나가기] 수행 (분기 옵션)
  const confirmLeaveChatWithoutReview = async () => {
    if (!matchId || leaving) return
    setLeaving(true)
    setShowLeaveModal(false)

    try {
      await chatAPI.leaveChat(matchId)
      await refreshUser?.()
      navigate('/home?tab=chat')
    } catch (err) {
      alert('채팅나가기 실패: ' + (err.response?.data?.detail || '오류가 발생했습니다.'))
      setLeaving(false)
    }
  }

  const handleBack = async () => {
    navigate('/home?tab=chat')
  }

  // 👤 [피드백 반영] 상대방 프로필(아바타/이름 영역) 클릭 시 정보 보기 모달 오픈
  const handleOpenPartnerInfo = () => {
    if (!partner) return
    setShowPartnerStats(false)
    setShowPartnerInfoModal(true)
  }

  if (!user) {
    return <div className={styles.emptyNotice}>로그인 후 이용할 수 있습니다.</div>
  }

  let lastDateStr = ''

  return (
    <div className={styles.chatContainer}>
      {/* 🔝 DM 헤더 Bar */}
      <div className={styles.header}>
        <button className={styles.backButton} onClick={handleBack} title="홈으로 이동">
          ← 홈으로
        </button>
        <div
          className={styles.partnerProfileHeader}
          onClick={handleOpenPartnerInfo}
          role="button"
          title="상대방 정보 보기"
          style={{ cursor: partner ? 'pointer' : 'default' }}
        >
          <img
            src={partner?.partner_profile_image || (partner?.partner_role === '농부' ? '/images/farmer.png' : '/images/chung.png')}
            alt={partner?.partner_name || '상대방 프로필'}
            className={styles.partnerAvatarImg}
          />
          <div className={styles.partnerNameCol}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <strong className={styles.partnerNameText}>
                {partner?.partner_name || '대화 상대방'}
              </strong>
              <span className={styles.partnerRoleBadge}>
                {partner?.partner_role || '소일거리 회원'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--color-text-sub)', marginTop: '2px' }}>
              <span>📍 {partner?.partner_location || '거주지 미설정'}</span>
              <span>·</span>
              <span>⭐ {partner?.partner_rating != null ? Number(partner.partner_rating).toFixed(1) : '0.0'}</span>
            </div>
          </div>
        </div>

        {matchId && (
          <button className={styles.leaveButton} onClick={() => setShowLeaveModal(true)} disabled={leaving}>
            채팅나가기
          </button>
        )}
      </div>

      {/* 📌 상단 AI 매칭 정보 슬림 핀 바 */}
      {partner && (
        <div className={styles.contextPinCard}>
          <span className={styles.contextPinBadge}>🤝 AI 매칭 연결됨</span>
          <span className={styles.contextPinText}>
            희망 업무: <strong>{partner.task || '농업 업무 매칭'}</strong>
          </span>
        </div>
      )}

      {/* 🚨 [피드백 반영] 채팅방 최초 입장 시 노출되는 "캡처 후 신고" 안내 배너 */}
      {showReportNotice && (
        <div className={styles.reportNoticeBanner}>
          <span className={styles.reportNoticeText}>
            ⚠️ 상대방의 폭언 등 부적절한 언행이나 문제가 발생하면, 대화 내용을 캡처하신 뒤
            AI 상담사 메뉴의 신고 기능으로 알려주세요. 접수된 내용은 담당자가 확인합니다.
          </span>
          <button
            type="button"
            className={styles.reportNoticeCloseBtn}
            onClick={handleDismissReportNotice}
            title="닫기"
          >
            ✕
          </button>
        </div>
      )}

      {error && <div className={styles.emptyNotice} style={{ color: '#ff6b6b' }}>{error}</div>}

      {/* 💬 DM 메시지 스크롤 영역 */}
      <div className={styles.messageListArea}>
        {!matchId ? (
          <div className={styles.emptyNotice}>
            선택된 매칭 대화방이 없습니다. 매칭 목록에서 대화를 시작해 주세요.
          </div>
        ) : loading && messages.length === 0 ? (
          <div className={styles.emptyNotice}>대화 내역을 불러오는 중...</div>
        ) : messages.length === 0 ? (
          <div className={styles.emptyNotice}>
            매칭이 성공적으로 이루어졌습니다! 🎉<br />아래 퀵 대화 칩을 눌러 첫 인사를 나눠보세요.
          </div>
        ) : (
          messages.map((msg) => {
            const isMyMessage = String(msg.sender_id) === String(user.id)
            const currentDateStr = msg.created_at ? formatKoreanDateHeader(msg.created_at) : ''
            
            let showDateHeader = false
            if (currentDateStr && currentDateStr !== lastDateStr) {
              showDateHeader = true
              lastDateStr = currentDateStr
            }

            return (
              <div key={msg.id || `${msg.sender_id}-${msg.created_at}`}>
                {/* 📅 날짜 변경 구분선 칩 */}
                {showDateHeader && (
                  <div className={styles.dateSeparatorRow}>
                    <span className={styles.dateSeparatorChip}>{currentDateStr}</span>
                  </div>
                )}

                {/* 💬 말풍선 행 */}
                <div className={`${styles.messageRow} ${isMyMessage ? styles.myRow : styles.otherRow}`}>
                  {!isMyMessage && (
                    <div className={styles.avatar}>
                      {partner?.partner_profile_image ? (
                        <img
                          src={partner.partner_profile_image}
                          alt={partner?.partner_name || '상대방'}
                          className={styles.avatarImg}
                        />
                      ) : (
                        <img
                          src={partner?.partner_role === '농부' ? avatarFarmer : avatarYouth}
                          alt={partner?.partner_name || '상대방'}
                          className={styles.avatarImg}
                        />
                      )}
                    </div>
                  )}
                  <div className={styles.messageWrapper}>
                    {!isMyMessage && (
                      <span className={styles.senderLabel}>
                        {partner?.partner_name || `상대방`}
                      </span>
                    )}
                    <div className={`${styles.bubble} ${isMyMessage ? styles.myBubble : styles.otherBubble}`}>
                      {/* 🖼️🎬 [피드백 반영] 이미지/동영상 첨부 메시지 렌더링 */}
                      {msg.message_type === 'image' && msg.file_url ? (
                        <a href={toAttachmentUrl(msg.file_url)} target="_blank" rel="noreferrer">
                          <img
                            src={toAttachmentUrl(msg.file_url)}
                            alt={msg.file_name || '이미지'}
                            className={styles.attachmentImage}
                          />
                        </a>
                      ) : msg.message_type === 'video' && msg.file_url ? (
                        <video
                          src={toAttachmentUrl(msg.file_url)}
                          controls
                          className={styles.attachmentVideo}
                        />
                      ) : (
                        msg.content
                      )}
                    </div>
                    <span className={styles.timestamp}>
                      {msg.created_at ? formatKoreanTime(msg.created_at) : ''}
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        )}
        {/* ⛔ 상대방 퇴장 알림 시스템 뱃지 */}
        {partner?.partner_left && (
          <div className={styles.partnerLeftNoticeBox}>
            <span>⛔ 상대방이 채팅방을 나가 더 이상 대화를 할 수 없습니다.</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ⚡ 빠른 인사말 퀵 칩 */}
      {matchId && (
        <div className={styles.quickReplyContainer}>
          {QUICK_REPLIES.map((chipText, i) => (
            <button
              key={i}
              type="button"
              className={styles.quickReplyChip}
              onClick={() => handleSendMessage(chipText)}
              disabled={partner?.partner_left}
            >
              {chipText}
            </button>
          ))}
        </div>
      )}

      {/* ⌨️ 둥근 캡슐 DM 입력 하단 바 */}
      <form className={styles.inputArea} onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
        {/* 🖼️🎬 [피드백 반영] 이미지/동영상 첨부 버튼 (이미지 20MB, 동영상 300MB 이하) */}
        <button
          type="button"
          className={styles.attachButton}
          onClick={handleClickAttach}
          disabled={!matchId || partner?.partner_left || uploadingFile}
          title="사진/동영상 보내기"
        >
          {uploadingFile ? '⏳' : '📎'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
        />
        <input
          type="text"
          className={styles.capsuleInput}
          placeholder={
            !matchId
              ? '대화방을 선택하세요.'
              : partner?.partner_left
              ? '상대방이 나가 대화를 입력할 수 없습니다.'
              : '메시지를 입력하세요...'
          }
          value={inputText}
          disabled={!matchId || partner?.partner_left}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          className={styles.sendButtonCapsule}
          disabled={!inputText.trim() || !matchId || partner?.partner_left}
        >
          ⬆
        </button>
      </form>

      {/* 👤 [피드백 반영] 상대방 프로필 클릭 시 뜨는 "정보 보기" 모달
          (기본 계정 정보 - 이메일/이름/거주지 등 - 는 제외하고, 매칭 스탯 정보만 노출) */}
      {showPartnerInfoModal && partner && (
        <div className={styles.modalOverlay} onClick={() => setShowPartnerInfoModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <img
              src={partner.partner_profile_image || (partner.partner_role === '농부' ? '/images/farmer.png' : '/images/chung.png')}
              alt={partner.partner_name || '상대방 프로필'}
              className={styles.partnerInfoAvatarImg}
            />
            <h3 className={styles.modalTitle}>{partner.partner_name || '상대방'}</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className={styles.partnerRoleBadge}>{partner.partner_role || '소일거리 회원'}</span>
              {partner.partner_level != null && (
                <span className={styles.partnerRoleBadge}>Lv.{partner.partner_level}</span>
              )}
            </div>
            <div className={styles.modalBodyText} style={{ marginTop: '8px' }}>
              <p className={styles.modalHighlight}>⭐ 평점 {partner.partner_rating != null ? Number(partner.partner_rating).toFixed(1) : '0.0'} / 5.0</p>

              {/* 📝 [피드백 반영] 상대방이 받은 리뷰 목록 - 평점 바로 아래에 위치 */}
              <div className={styles.partnerReviewsArea}>
                <h4 className={styles.partnerReviewsTitle}>
                  📝 받은 리뷰{partner.partner_reviews?.length ? ` (${partner.partner_reviews.length})` : ''}
                </h4>
                {partner.partner_reviews && partner.partner_reviews.length > 0 ? (
                  <div className={styles.partnerReviewsList}>
                    {partner.partner_reviews.map((r) => (
                      <div key={r.id} className={styles.partnerReviewItem}>
                        <div className={styles.partnerReviewHeader}>
                          <span className={styles.partnerReviewerName}>{r.reviewer_name}</span>
                          <span className={styles.partnerReviewRating}>⭐ {Number(r.rating).toFixed(1)}</span>
                        </div>
                        {r.comment && <p className={styles.partnerReviewComment}>{r.comment}</p>}
                        <span className={styles.partnerReviewDate}>{formatReviewDate(r.created_at)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.partnerReviewEmpty}>아직 받은 리뷰가 없어요.</p>
                )}
              </div>

              {/* 📊 [피드백 반영] 매칭 스탯은 청년에게만 의미 있는 정보라 농부는 표시하지 않음.
                  청년의 경우 "스탯보기" 버튼을 눌러야 육각형/숫자 지표가 펼쳐지도록 토글 처리 */}
              {partner.partner_role !== '농부' && partner.partner_stats && (
                <div className={styles.partnerStatsSection}>
                  <button
                    type="button"
                    className={styles.partnerStatsToggleBtn}
                    onClick={() => setShowPartnerStats((prev) => !prev)}
                  >
                    {showPartnerStats ? '📊 스탯 접기 ▲' : '📊 스탯보기 ▼'}
                  </button>
                  {showPartnerStats && (
                    <div className={styles.partnerStatsArea}>
                      <StatHexagon
                        size={160}
                        items={PARTNER_STAT_DISPLAY.map((s) => ({ label: s.label, value: partner.partner_stats[s.field] ?? 0 }))}
                      />
                      <div className={styles.partnerStatsNumeric}>
                        {PARTNER_STAT_DISPLAY.map((s) => (
                          <div key={s.field} className={styles.partnerStatBox}>
                            <span>{s.icon} {s.label}</span>
                            <strong>{partner.partner_stats[s.field] ?? 0}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={styles.modalBtnGroupVertical}>
              <button
                className={`btn ${styles.modalSkipBtn}`}
                onClick={() => setShowPartnerInfoModal(false)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🥕 당근마켓 스타일 화면 중앙 별점 & 한줄후기 평점 남기기 커스텀 모달 팝업 */}
      {showLeaveModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalIconArea}>⭐</div>
            <h3 className={styles.modalTitle}>채팅방 나가기 & 평점 남기기</h3>
            
            <div className={styles.modalBodyText}>
              <p className={styles.modalHighlight}>
                <strong>{partner?.partner_name || '상대방'}</strong>님과의 소일거리 대화는 어떠하셨나요?
              </p>
              
              {/* ⭐️ 별점 1~5점 선택 인터랙션 */}
              <div className={styles.starRatingSelector}>
                {[1, 2, 3, 4, 5].map((starVal) => (
                  <button
                    key={starVal}
                    type="button"
                    className={`${styles.starBtn} ${selectedRating >= starVal ? styles.starActive : ''}`}
                    onClick={() => setSelectedRating(starVal)}
                  >
                    ★
                  </button>
                ))}
                <span className={styles.ratingNumText}>{selectedRating.toFixed(1)}점</span>
              </div>

              {/* ✍️ 한줄 후기 작성 필드 */}
              <input
                type="text"
                className={styles.modalReviewInput}
                placeholder="상대방을 위한 따뜻한 한 줄 후기를 남겨주세요 (선택)"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
              />
            </div>

            <div className={styles.modalBtnGroupVertical}>
              <button
                className={`btn ${styles.modalConfirmBtn}`}
                onClick={confirmLeaveChatWithReview}
                disabled={leaving}
              >
                {leaving ? '처리 중...' : '⭐ 평점 제출하고 대화 종료하기'}
              </button>
              <button
                className={`btn ${styles.modalSkipBtn}`}
                onClick={confirmLeaveChatWithoutReview}
                disabled={leaving}
              >
                👋 별점 없이 단순 나가기
              </button>
              <button
                className={styles.modalCancelLinkBtn}
                onClick={() => setShowLeaveModal(false)}
                disabled={leaving}
              >
                취소 (대화 계속하기)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}