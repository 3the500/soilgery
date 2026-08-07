import { useState, useEffect, useRef } from 'react'
import { supportAPI } from '../../api/index'
import styles from './Support.module.css'

export default function Support() {
  const [messages, setMessages] = useState([
    { sender: 'ai', text: '안녕하세요! 충북 농촌 소일거리 AI 상담사입니다. 😊\n아래 자주 묻는 질문을 선택하거나, 궁금한 내용을 자유롭게 입력해보세요.' }
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

  const handleSelectFaq = async (faq) => {
    setMessages((prev) => [...prev, { sender: 'user', text: faq.question }])
    setLoading(true)
    try {
      const res = await supportAPI.getFaqAnswer(faq.id)
      setMessages((prev) => [...prev, { sender: 'ai', text: res.data.message }])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { sender: 'ai', text: '죄송합니다. 답변을 가져오지 못했습니다: ' + (err.response?.data?.detail || '연결 실패') }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMsg = input
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }])
    setInput('')
    setLoading(true)

    try {
      const res = await supportAPI.askAi(userMsg)
      setMessages((prev) => [...prev, { sender: 'ai', text: res.data.message }])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { sender: 'ai', text: '죄송합니다. 오류가 발생했습니다: ' + (err.response?.data?.detail || '연결 실패') }
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>🤖 AI 1:1 상담사</h1>
      </div>

      <div className={styles.chatBox}>
        {messages.map((m, idx) => {
          const isUser = m.sender === 'user'
          return (
            <div key={idx} className={`${styles.msgRow} ${isUser ? styles.userMsgRow : styles.aiMsgRow}`}>
              <div className={`${styles.msgBubble} ${isUser ? styles.userMsgBubble : styles.aiMsgBubble}`}>
                {m.text}
              </div>
            </div>
          )
        })}
        {loading && (
          <div className={styles.loadingText}>
            🤖 AI가 답변을 작성 중입니다...
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {faqs.length > 0 && (
        <div className={styles.faqSection}>
          <span className={styles.faqLabel}>💡 자주 묻는 질문</span>
          <div className={styles.faqChips}>
            {faqs.map((faq) => (
              <button
                key={faq.id}
                type="button"
                className={styles.faqChip}
                onClick={() => handleSelectFaq(faq)}
                disabled={loading}
              >
                {faq.question}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSend} className={styles.inputForm}>
        <input
          type="text"
          className={styles.inputField}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="질문이나 궁금한 점을 입력하세요 (예: 급여 조건 등)"
        />
        <button type="submit" className={styles.submitBtn} disabled={loading || !input.trim()}>
          전송
        </button>
      </form>
    </div>
  )
}