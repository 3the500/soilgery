import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import { supportAPI } from '../../api/index'
import styles from './Support.module.css'
import soilyiImg from '../../assets/icons/character_soilyi.jpg'

const DEFAULT_WELCOME_MSG = {
  sender: 'ai',
  text: '안녕하세요! 충북 소일거리 안내원 \'소일이\'입니다. 🌱🍎\n\n농가 일손 구하기, 맞춤 업무 추천, 급여나 조건 등 궁금하신 점이 있으시면 편하게 물어보세요!',
  time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

export default function Support() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const storageKey = user ? `soilgery_support_messages_${user.id}` : 'soilgery_support_messages_guest'

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      }
    } catch (e) {
      console.error('상담 대화기록 불러오기 오류:', e)
    }
    return [DEFAULT_WELCOME_MSG]
  })

  const [faqs, setFaqs] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatBottomRef = useRef(null)

  // 💾 유저별 상담 대화기록 자동 저장
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages))
    } catch (e) {
      console.error('상담 대화기록 저장 오류:', e)
    }
  }, [messages, storageKey])

  // 🧹 대화내역 초기화
  const handleClearHistory = () => {
    if (window.confirm('이전 상담 대화 기록을 초기화하시겠습니까?')) {
      const resetMsgs = [{
        ...DEFAULT_WELCOME_MSG,
        time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      }]
      setMessages(resetMsgs)
      localStorage.removeItem(storageKey)
    }
  }

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    supportAPI.getFaqs()
      .then((res) => setFaqs(res.data))
      .catch((err) => console.error('FAQ 목록 조회 실패:', err))
  }, [])

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }

  const handleSelectFaq = async (faq) => {
    if (loading) return
    const userTime = getCurrentTime()
    setMessages((prev) => [...prev, { sender: 'user', text: faq.question, time: userTime }])
    setLoading(true)
    try {
      const res = await supportAPI.getFaqAnswer(faq.id)
      setMessages((prev) => [...prev, { sender: 'ai', text: res.data.message, time: getCurrentTime() }])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { sender: 'ai', text: '죄송합니다. 답변을 가져오지 못했습니다: ' + (err.response?.data?.detail || '연결 실패'), time: getCurrentTime() }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMsg = input.trim()
    const userTime = getCurrentTime()
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg, time: userTime }])
    setInput('')
    setLoading(true)

    try {
      const res = await supportAPI.askAi(userMsg)
      setMessages((prev) => [...prev, { sender: 'ai', text: res.data.message, time: getCurrentTime() }])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { sender: 'ai', text: '죄송합니다. 오류가 발생했습니다: ' + (err.response?.data?.detail || '연결 실패'), time: getCurrentTime() }
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      {/* 🔝 상단 헤더 */}
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/home?tab=matching')}>
          ← 홈으로
        </button>
        <div className={styles.headerCenter}>
          <h1 className={styles.headerTitle}>💬 소일이 1:1 상담실</h1>
        </div>
        <button className={styles.clearBtn} onClick={handleClearHistory} title="상담 대화기록 초기화">
          🧹 초기화
        </button>
      </header>

      {/* 💬 토스 챗봇 메인 메세지 스크롤 영역 */}
      <main className={styles.chatContainer}>
        {/* 날짜 분리 칩 */}
        <div className={styles.dateHeaderChip}>
          <span>오늘</span>
        </div>

        {messages.map((m, idx) => {
          const isUser = m.sender === 'user'
          return (
            <div
              key={idx}
              className={`${styles.msgGroup} ${isUser ? styles.userMsgGroup : styles.aiMsgGroup}`}
            >
              {!isUser && (
                <div className={styles.aiAvatar}>
                  <img src={soilyiImg} alt="소일이" className={styles.aiAvatarImg} />
                </div>
              )}

              <div className={styles.msgContentArea}>
                {!isUser && <span className={styles.aiNameLabel}>소일거리 마스코트 소일이</span>}
                <div className={styles.bubbleRow}>
                  {isUser && <span className={styles.msgTime}>{m.time}</span>}
                  <div className={`${styles.msgBubble} ${isUser ? styles.userBubble : styles.aiBubble}`}>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{m.text}</p>
                  </div>
                  {!isUser && <span className={styles.msgTime}>{m.time}</span>}
                </div>
              </div>
            </div>
          )
        })}

        {loading && (
          <div className={`${styles.msgGroup} ${styles.aiMsgGroup}`}>
            <div className={styles.aiAvatar}>
              <span>🤖</span>
            </div>
            <div className={styles.msgContentArea}>
              <span className={styles.aiNameLabel}>소일거리 AI 챗봇</span>
              <div className={styles.typingIndicator}>
                <span>AI가 답변을 작성 중입니다...</span>
                <div className={styles.dots}>
                  <div className={styles.dot} />
                  <div className={styles.dot} />
                  <div className={styles.dot} />
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </main>

      {/* 💡 자주 묻는 질문 토스 퀵 칩 스크롤 바 */}
      {faqs.length > 0 && (
        <div className={styles.faqQuickBar}>
          <div className={styles.faqQuickBarHeader}>
            <span>💡 자주 묻는 질문</span>
          </div>
          <div className={styles.faqChipScrollRow}>
            {faqs.map((faq) => (
              <button
                key={faq.id}
                type="button"
                className={styles.faqQuickChip}
                onClick={() => handleSelectFaq(faq)}
                disabled={loading}
              >
                {faq.question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 💊 토스 캡슐형 하단 입력 바 */}
      <footer className={styles.footer}>
        <form onSubmit={handleSend} className={styles.capsuleInputForm}>
          <input
            type="text"
            className={styles.capsuleInputField}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="궁금한 내용을 입력하세요 (예: 매칭 방법)"
          />
          <button
            type="submit"
            className={styles.capsuleSubmitBtn}
            disabled={loading || !input.trim()}
          >
            전송
          </button>
        </form>
      </footer>
    </div>
  )
}