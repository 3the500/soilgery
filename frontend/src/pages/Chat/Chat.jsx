import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import api, { chatAPI } from '../../api/index'
import styles from './Chat.module.css'

// 백엔드는 UTC 시각을 타임존 표기 없이 내려준다 (예: "2026-08-07T04:34:12").
// 이 문자열을 그대로 new Date()에 넘기면 브라우저가 "로컬 시간"으로 오인해서
// UTC 값 그대로를 화면에 뿌려버린다(한국 기준 9시간 이르게 표시됨).
// 타임존 표기(Z 또는 +09:00 등)가 없으면 UTC임을 명시하는 'Z'를 붙여준다.
const toLocalDate = (isoString) => {
  if (!isoString) return null
  const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/.test(isoString)
  return new Date(hasTimezone ? isoString : `${isoString}Z`)
}

// 접속 기기의 시스템 로케일/타임존이 한국이 아니어도(서버 배포 환경 등) 항상
// 한국 시간(Asia/Seoul) 기준 "오전/오후 h:mm" 형식으로 보여주기 위해
// locale과 timeZone을 명시적으로 고정한다.
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

export default function Chat() {
  const { matchId: paramMatchId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [matchId, setMatchId] = useState(paramMatchId || null)
  const [messages, setMessages] = useState([])
  const [partner, setPartner] = useState(null) // { partner_id, partner_name, partner_role, partner_left }
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [leaving, setLeaving] = useState(false)

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

  const handleSendMessage = async (e) => {
    e?.preventDefault()
    if (!inputText.trim() || !matchId) return

    const contentToSend = inputText.trim()
    setInputText('')

    try {
      const res = await api.post(`/matches/${matchId}/messages`, {
        content: contentToSend
      })
      setMessages((prev) => [...prev, res.data])
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

  // '채팅나가기' 버튼: 항상 확인 후 나에게서 이 채팅방을 나간다.
  const handleLeaveChat = async () => {
    if (!matchId || leaving) return
    const confirmed = window.confirm('채팅방을 나가시겠습니까? 나가면 이 채팅방이 목록에서 사라집니다.')
    if (!confirmed) return

    setLeaving(true)
    try {
      await chatAPI.leaveChat(matchId)
      navigate('/home')
    } catch (err) {
      alert('채팅나가기 실패: ' + (err.response?.data?.detail || '오류가 발생했습니다.'))
      setLeaving(false)
    }
  }

  // '뒤로가기' 버튼: 평소엔 그냥 이전 화면으로 돌아가지만, 상대방이 이미 채팅을
  // 나간 상태라면 이 시점에 나도 함께 나가서(채팅방을 정리) 목록에서 사라지게 한다.
  const handleBack = async () => {
    if (matchId && partner?.partner_left && !leaving) {
      setLeaving(true)
      try {
        await chatAPI.leaveChat(matchId)
      } catch (err) {
        console.error('채팅나가기 실패:', err)
      }
    }
    navigate('/home')
  }

  if (!user) {
    return <div className={styles.emptyNotice}>로그인 후 이용할 수 있습니다.</div>
  }

  return (
    <div className={styles.chatContainer}>
      <div className={styles.header}>
        <div className={styles.headerLeftGroup}>
          <button className={styles.backButton} onClick={handleBack}>
            ← 뒤로가기
          </button>
          {matchId && (
            <button className={styles.leaveButton} onClick={handleLeaveChat} disabled={leaving}>
              채팅나가기
            </button>
          )}
        </div>
        <div className={styles.headerTitle}>
          {partner?.partner_name
            ? `💬 ${partner.partner_name}${partner.partner_role ? `(${partner.partner_role})` : ''}님과의 대화`
            : `💬 매칭 대화방 ${matchId ? `#${matchId}` : ''}`}
        </div>
      </div>

      {partner?.partner_left && (
        <div className={styles.partnerLeftNotice}>
          상대방이 채팅을 나갔습니다.
        </div>
      )}

      {error && <div className={styles.emptyNotice} style={{ color: '#ff6b6b' }}>{error}</div>}

      <div className={styles.messageListArea}>
        {!matchId ? (
          <div className={styles.emptyNotice}>
            선택된 매칭 대화방이 없습니다. 매칭 목록에서 대화를 시작해 주세요.
          </div>
        ) : loading && messages.length === 0 ? (
          <div className={styles.emptyNotice}>대화 내역을 불러오는 중...</div>
        ) : messages.length === 0 ? (
          <div className={styles.emptyNotice}>
            매칭이 성공적으로 이루어졌습니다! 🎉<br />첫 메시지를 보내 인사를 나누어보세요.
          </div>
        ) : (
          messages.map((msg) => {
            const isMyMessage = msg.sender_id === user.id
            return (
              <div
                key={msg.id || `${msg.sender_id}-${msg.created_at}`}
                className={`${styles.messageRow} ${isMyMessage ? styles.myRow : styles.otherRow}`}
              >
                {!isMyMessage && <div className={styles.avatar}>👤</div>}
                <div className={styles.messageWrapper}>
                  {!isMyMessage && (
                    <span className={styles.senderLabel}>
                      {partner?.partner_name || `상대방 (#${msg.sender_id})`}
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
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className={styles.inputArea} onSubmit={handleSendMessage}>
        <textarea
          className={styles.textInput}
          rows={1}
          placeholder={
            !matchId
              ? '대화방을 선택하세요.'
              : partner?.partner_left
              ? '상대방이 채팅을 나가 더 이상 메시지를 보낼 수 없습니다.'
              : '메시지를 입력하세요... (Enter 전송)'
          }
          value={inputText}
          disabled={!matchId || partner?.partner_left}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          className={styles.sendButton}
          disabled={!inputText.trim() || !matchId || partner?.partner_left}
        >
          전송
        </button>
      </form>
    </div>
  )
}