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

export default function Chat() {
  const { matchId: paramMatchId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [matchId, setMatchId] = useState(paramMatchId || null)
  const [messages, setMessages] = useState([])
  const [partner, setPartner] = useState(null) // { partner_id, partner_name, partner_role }
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  if (!user) {
    return <div className={styles.emptyNotice}>로그인 후 이용할 수 있습니다.</div>
  }

  return (
    <div className={styles.chatContainer}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          ← 뒤로가기
        </button>
        <div className={styles.headerTitle}>
          {partner?.partner_name
            ? `💬 ${partner.partner_name}${partner.partner_role ? `(${partner.partner_role})` : ''}님과의 대화`
            : `💬 매칭 대화방 ${matchId ? `#${matchId}` : ''}`}
        </div>
      </div>

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
                    {msg.created_at
                      ? toLocalDate(msg.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
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
          placeholder={matchId ? '메시지를 입력하세요... (Enter 전송)' : '대화방을 선택하세요.'}
          value={inputText}
          disabled={!matchId}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          className={styles.sendButton}
          disabled={!inputText.trim() || !matchId}
        >
          전송
        </button>
      </form>
    </div>
  )
}