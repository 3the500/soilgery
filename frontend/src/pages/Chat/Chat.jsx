import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react'
import { useAuth } from '../../store/AuthContext'
import api, { chatAPI, reviewAPI } from '../../api/index'
import { useToast } from '../../context/ToastContext'
import styles from './Chat.module.css'

const toLocalDate = (isoString) => {
  if (!isoString) return new Date()
  const d = new Date(isoString)
  return isNaN(d.getTime()) ? new Date() : d
}

const formatKoreanTime = (isoString) => {
  const d = toLocalDate(isoString)
  return d.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

const formatKoreanDateHeader = (isoString) => {
  const d = toLocalDate(isoString)
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
}

const YOUTH_QUICK_REPLIES = [
  '안녕하세요! 어떤 일을 주로 하게 되나요? 🌾',
  '상세 작업 일정이 궁금합니다!',
  '거주 지역 근처 소일거리 맞나요?',
  '감사합니다. 잘 부탁드립니다! 🙏',
]

const FARMER_QUICK_REPLIES = [
  '안녕하세요! 소일거리 세부 내용 안내해 드립니다 🌾',
  '작업 일정 및 일당 조건 확인해 주세요!',
  '언제부터 근무 시작 가능하신가요?',
  '반갑습니다! 모르는 점은 질문해 주세요. 😊',
]

export default function Chat() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const { showToast } = useToast()

  const isFarmer = user?.role === '농부'
  const activeQuickReplies = isFarmer ? FARMER_QUICK_REPLIES : YOUTH_QUICK_REPLIES

  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [partner, setPartner] = useState(null)
  const [partnerLoading, setPartnerLoading] = useState(true)

  // 🔒 중복 전송 방지 및 퇴장 처리 상태
  const [isSending, setIsSending] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [selectedRating, setSelectedRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')

  const messagesEndRef = useRef(null)

  // 📜 하단 자동 스크롤 함수 (smooth/auto 옵션)
  const scrollToBottom = (smooth = true) => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end',
      })
    })
  }

  // 1. 상대방 프로필 정보 및 대화방 정보 조회
  const fetchPartnerInfo = async () => {
    if (!matchId) return
    try {
      const res = await chatAPI.getMatchInfo(matchId)
      setPartner(res.data)
    } catch (err) {
      console.error('상대방 정보 조회 실패:', err)
      setError('채팅방 정보를 불러올 수 없습니다.')
    } finally {
      setPartnerLoading(false)
    }
  }

  // 2. 대화 내역 조회
  const fetchMessages = async (isInitial = false) => {
    if (!matchId) return
    try {
      const res = await chatAPI.getMessages(matchId)
      setMessages((prev) => {
        // 메시지 수가 변경되었을 때만 스크롤 하단 이동
        if (prev.length !== res.data.length) {
          setTimeout(() => scrollToBottom(!isInitial), 60)
        }
        return res.data
      })
      localStorage.setItem('last_seen_chat_time', new Date().toISOString())
    } catch (err) {
      console.error('메시지 대화 내역 조회 실패:', err)
      if (isInitial) {
        setError('대화 내역을 불러오지 못했습니다.')
      }
    } finally {
      if (isInitial) setLoading(false)
    }
  }

  // ⚡ 3초 실시간 자동 수신 폴링 & 초기화
  useEffect(() => {
    if (!matchId) return

    setLoading(true)
    setPartnerLoading(true)
    setError(null)

    fetchPartnerInfo()
    fetchMessages(true)

    // 3초 주기로 메시지 및 상대방 상태(퇴장 여부) 자동 동기화
    const intervalId = setInterval(() => {
      fetchMessages(false)
      fetchPartnerInfo()
    }, 3000)

    return () => clearInterval(intervalId)
  }, [matchId])

  // 메시지 렌더링 후 스크롤 하단 밀림 보완
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(true)
    }
  }, [messages.length])

  // ✉️ 메시지 전송 처리 (공백 검증, 중복 전송 방지)
  const handleSendMessage = async (textToSend) => {
    const rawContent = textToSend || inputText
    const content = rawContent ? rawContent.trim() : ''

    if (!content || !matchId || isSending) return
    if (partner?.partner_left) {
      showToast('상대방이 나가 더 이상 대화를 입력할 수 없습니다. ⛔', 'error')
      return
    }

    setIsSending(true)
    if (!textToSend) {
      setInputText('')
    }

    try {
      const res = await api.post(`/matches/${matchId}/messages`, { content })
      setMessages((prev) => [...prev, res.data])
      localStorage.setItem('last_seen_chat_time', new Date().toISOString())
      setTimeout(() => scrollToBottom(true), 60)
    } catch (err) {
      showToast('메시지 전송 실패: ' + (err.response?.data?.detail || '오류가 발생했습니다.'), 'error')
    } finally {
      setIsSending(false)
    }
  }

  // 한글 IME 이중 입력 및 엔터키 전송 방지
  const handleKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // 🥕 당근마켓 스타일 모달에서 [⭐ 평점 제출 & 나가기] 수행 (실시간 동기화 포함)
  const confirmLeaveChatWithReview = async () => {
    if (!matchId || leaving) return
    setLeaving(true)
    setShowLeaveModal(false)

    try {
      if (partner?.partner_id) {
        await reviewAPI.createReview({
          reviewee_id: partner.partner_id,
          match_id: Number(matchId),
          rating: selectedRating,
          comment: reviewComment.trim() || '소일거리 매칭 대화 후 퇴장하였습니다.',
        })
        showToast('소중한 평점과 후기가 성공적으로 전달되었습니다! ⭐', 'success')
      }
    } catch (err) {
      console.error('리뷰 작성 처리 중 예외 (무시 후 나가기 진행):', err)
    }

    try {
      await chatAPI.leaveChat(matchId)
      await refreshUser?.()
      navigate('/home?tab=review')
    } catch (err) {
      showToast('채팅나가기 실패: ' + (err.response?.data?.detail || '오류가 발생했습니다.'), 'error')
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
      showToast('별점 작성 없이 채팅방을 나갔습니다.', 'info')
      navigate('/home?tab=chat')
    } catch (err) {
      showToast('채팅나가기 실패: ' + (err.response?.data?.detail || '오류가 발생했습니다.'), 'error')
      setLeaving(false)
    }
  }

  const handleBack = () => {
    navigate('/home?tab=chat')
  }

  if (!user) {
    return <div className={styles.emptyNotice}>로그인 후 이용할 수 있습니다.</div>
  }

  let lastDateStr = ''

  return (
    <div className={styles.chatContainer}>
      {/* 🔝 DM 헤더 Bar */}
      <div className={styles.header}>
        <button className={styles.backButton} onClick={handleBack} title="메인화면으로 이동">
          ← 메인화면
        </button>

        <div className={styles.partnerProfileHeader}>
          {partnerLoading ? (
            <div className={styles.partnerSkeleton}>상대방 정보 확인 중...</div>
          ) : (
            <>
              <span className={styles.partnerAvatarEmoji}>
                {partner?.partner_role === '농부' ? '👨‍🌾' : '🧑‍🌾'}
              </span>
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
                  <span>⭐ {partner?.partner_rating ? Number(partner.partner_rating).toFixed(1) : '0.0'}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {matchId && (
          <button
            className={styles.leaveButton}
            onClick={() => setShowLeaveModal(true)}
            disabled={leaving}
          >
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
                      {partner?.partner_role === '농부' ? '👨‍🌾' : '🧑‍🌾'}
                    </div>
                  )}
                  <div className={styles.messageWrapper}>
                    {!isMyMessage && (
                      <span className={styles.senderLabel}>
                        {partner?.partner_name || `상대방`}
                      </span>
                    )}
                    <div className={`${styles.bubble} ${isMyMessage ? styles.myBubble : styles.otherBubble}`}>
                      <p className={styles.bubbleText}>{msg.content}</p>
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
        <div
          className={styles.quickReplyContainer}
          onClick={() => {
            if (partner?.partner_left) {
              showToast('상대방이 나가 더 이상 대화를 입력할 수 없습니다. ⛔', 'error')
            }
          }}
        >
          {activeQuickReplies.map((chipText, i) => (
            <button
              key={i}
              type="button"
              className={styles.quickReplyChip}
              onClick={() => handleSendMessage(chipText)}
              disabled={partner?.partner_left || isSending}
            >
              {chipText}
            </button>
          ))}
        </div>
      )}

      {/* ⌨️ 둥근 캡슐 DM 입력 하단 바 */}
      <form
        className={styles.inputArea}
        onSubmit={(e) => {
          e.preventDefault()
          handleSendMessage()
        }}
        onClick={() => {
          if (partner?.partner_left) {
            showToast('상대방이 나가 더 이상 대화를 입력할 수 없습니다. ⛔', 'error')
          }
        }}
      >
        <textarea
          className={styles.capsuleInput}
          rows={1}
          placeholder={
            !matchId
              ? '대화방을 선택하세요.'
              : partner?.partner_left
              ? '상대방이 나가 대화를 입력할 수 없습니다.'
              : '메시지를 입력하세요...'
          }
          value={inputText}
          disabled={!matchId || partner?.partner_left || isSending}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          className={styles.sendButtonCapsule}
          disabled={!inputText.trim() || !matchId || partner?.partner_left || isSending}
        >
          {isSending ? '...' : '⬆'}
        </button>
      </form>

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