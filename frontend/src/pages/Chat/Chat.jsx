import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import api, { chatAPI, reviewAPI } from '../../api/index'
import styles from './Chat.module.css'

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

  // 🥕 당근마켓 스타일 화면 중앙 커스텀 퇴장 & 평점 작성 모달 제어 상태
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [selectedRating, setSelectedRating] = useState(5.0)
  const [reviewComment, setReviewComment] = useState('')

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

    const interval = setInterval(() => {
      fetchMessages(currentMatchId)
    }, 2000)

    return () => clearInterval(interval)
  }, [paramMatchId, matchId, user])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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

  const handleBack = async () => {
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
          <span className={styles.partnerAvatarEmoji}>
            {partner?.partner_role === '농부' ? '👨‍🌾' : '🧑‍🌾'}
          </span>
          <div className={styles.partnerNameCol}>
            <strong className={styles.partnerNameText}>
              {partner?.partner_name || '대화 상대방'}
            </strong>
            <span className={styles.partnerRoleBadge}>
              {partner?.partner_role || '소일거리 회원'}
            </span>
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
                      {msg.content}
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
            >
              {chipText}
            </button>
          ))}
        </div>
      )}

      {/* ⌨️ 둥근 캡슐 DM 입력 하단 바 */}
      <form className={styles.inputArea} onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
        <input
          type="text"
          className={styles.capsuleInput}
          placeholder={
            !matchId ? '대화방을 선택하세요.' : '메시지를 입력하세요...'
          }
          value={inputText}
          disabled={!matchId}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          className={styles.sendButtonCapsule}
          disabled={!inputText.trim() || !matchId}
        >
          ⬆
        </button>
      </form>

      {/* 🥕 당근마켓 스타일 화면 중앙 별점 & 한줄후기 평점 남기기 커스텀 모달 팝업 */}
      {showLeaveModal && (
        <div className={styles.modalOverlay} onClick={() => setShowLeaveModal(false)}>
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

            <div className={styles.modalBtnGroup}>
              <button
                className={styles.modalCancelBtn}
                onClick={() => setShowLeaveModal(false)}
              >
                취소
              </button>
              <button
                className={styles.modalConfirmBtn}
                onClick={confirmLeaveChatWithReview}
                disabled={leaving}
              >
                {leaving ? '제출 중...' : '평점 제출 및 나가기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}