import { useState, useEffect } from 'react'
import { supportAPI } from '../../api/index'

export default function Support() {
  const [messages, setMessages] = useState([
    { sender: 'ai', text: '안녕하세요! 충북 농촌 소일거리 AI 상담사입니다. 아래 자주 묻는 질문을 선택하거나, 궁금한 내용을 직접 입력해보세요.' }
  ])
  const [faqs, setFaqs] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supportAPI.getFaqs()
      .then((res) => setFaqs(res.data)) // [{ id, question }, ...]
      .catch((err) => console.error('FAQ 목록 조회 실패:', err))
  }, [])

  // 미리 정해진 질문 선택 -> AI 호출 없이 모범 답안을 즉시 반환
  const handleSelectFaq = async (faq) => {
    setMessages((prev) => [...prev, { sender: 'user', text: faq.question }])
    setLoading(true)
    try {
      const res = await supportAPI.getFaqAnswer(faq.id) // AiAnswerResponse: { type, message }
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

  // 자유 입력 -> AI가 분석해서 답변 (신고로 판단되면 접수 안내만 반환)
  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMsg = input
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }])
    setInput('')
    setLoading(true)

    try {
      const res = await supportAPI.askAi(userMsg) // AiAnswerResponse: { type, message }
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
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>🤖 AI 1:1 상담사</h1>
      <div style={{ height: '400px', border: '1px solid #ddd', overflowY: 'auto', padding: '10px', marginBottom: '10px' }}>
        {messages.map((m, idx) => (
          <div key={idx} style={{ textAlign: m.sender === 'user' ? 'right' : 'left', margin: '10px 0' }}>
            <span style={{
              display: 'inline-block',
              padding: '8px 12px',
              borderRadius: '12px',
              background: m.sender === 'user' ? '#007bff' : '#e9ecef',
              color: m.sender === 'user' ? '#fff' : '#000'
            }}>
              {m.text}
            </span>
          </div>
        ))}
        {loading && <p>AI가 답변을 생각하는 중...</p>}
      </div>

      {faqs.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <p style={{ fontSize: '13px', color: '#666' }}>자주 묻는 질문</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {faqs.map((faq) => (
              <button
                key={faq.id}
                type="button"
                onClick={() => handleSelectFaq(faq)}
                disabled={loading}
                style={{ padding: '6px 10px', borderRadius: '14px', border: '1px solid #ccc', background: '#f8f9fa', fontSize: '13px' }}
              >
                {faq.question}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="질문을 입력하세요..."
          style={{ flex: 1, padding: '10px' }}
        />
        <button type="submit" disabled={loading} style={{ padding: '10px 20px' }}>전송</button>
      </form>
    </div>
  )
}