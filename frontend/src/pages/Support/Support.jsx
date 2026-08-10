import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supportAPI } from '../../api/index'
import styles from './Support.module.css'

export default function Support() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: '안녕하세요! 충주 청정 농원 소일거리 AI 마스코트 \'소일이\'입니다. 🌱🍎\n\n충주 명품 사과 과수원 일손 매칭, 적성검사, 급여 조건 등 궁금하신 점을 편하게 질문해 주세요!',
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    }
  ])
  const [faqs, setFaqs] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatBottomRef = useRef(null)

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
      {/* 🔝 토스 스타일 상단 헤더 */}
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/home?tab=matching')}>
          ← 메인화면
        </button>
        <div className={styles.headerCenter}>
          <h1 className={styles.headerTitle}>🤖 AI 소일이 1:1 상담실</h1>
        </div>
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
                  <span>🤖</span>
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