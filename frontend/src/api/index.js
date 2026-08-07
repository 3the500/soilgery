import axios from 'axios'

// 백엔드 기본 URL 설정 (배포 주소가 있으면 최우선, 로컬 테스트 시 8000 포트 지정)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// 요청마다 토큰 자동 첨부
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 401 Unauthorized 발생 시 자동 로그아웃 처리
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// ── Auth API ────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  getUsers: () => api.get('/auth/users'),
}

// ── 2. 적성검사(Aptitude Test) API ────────────────
export const aptitudeAPI = {
  getQuestions: () => api.get('/aptitude-test/questions'),
  submitTest: (data) => api.post('/aptitude-test/submit', data),
  getMyStats: () => api.get('/aptitude-test/my-stats'),
}

// ── 3. 매칭(Matching) API ─────────────────────────
export const matchingAPI = {
  // 청년: 추천 업무 조회
  getRecommendedTasks: (topN = 3) => api.get(`/users/me/recommended-task?top_n=${topN}`),
  // 청년: 매칭 신청 / 취소
  requestMatch: () => api.post('/users/me/request-match'),
  cancelMatchRequest: () => api.post('/users/me/cancel-match-request'),
  // 내 매칭 연결 현황 조회 (매칭 여부, 상대방 정보, match_id)
  getMyMatch: () => api.get('/users/me/match'),
  // 내가 아직 나가지 않은 채팅방(매칭) 전체 목록 조회
  getMyMatches: () => api.get('/users/me/matches'),
  // 농부: 특정 공고의 후보자 목록 조회
  getCandidates: (postingId, useAi = true) => 
    api.get(`/job-postings/${postingId}/candidates?use_ai=${useAi}`),
  // 농부: 매칭 생성
  createMatch: (postingId, employeeId) => 
    api.post(`/job-postings/${postingId}/match`, { employee_id: employeeId }),
  // 업무별 후보자 조회(26.08.07 추영현)
  getCandidatesByTask: (taskName) => 
    api.get(`/candidates/by-task/${encodeURIComponent(taskName)}`),
  // 업무별 매칭 생성 (신규)
  createMatchByTask: (taskName, employeeId) => 
    api.post(`/match/by-task?task_name=${encodeURIComponent(taskName)}`, { employee_id: employeeId }),
}

// ── 4. 공고(Job Postings) API ─────────────────────
export const postingAPI = {
  createPosting: (data) => api.post('/job-postings', data),
  getPostings: (status = 'open') => api.get(`/job-postings?status=${status}`),
  getPostingDetail: (postingId) => api.get(`/job-postings/${postingId}`),
  closePosting: (postingId) => api.post(`/job-postings/${postingId}/close`),
}

// ── 5. 채팅(Chat) API ─────────────────────────────
export const chatAPI = {
  sendMessage: (matchId, content) => 
    api.post(`/matches/${matchId}/messages`, { content }),
  getMessages: (matchId) => api.get(`/matches/${matchId}/messages`),
  // 채팅방 상대방 정보(이름/역할) 조회
  getMatchInfo: (matchId) => api.get(`/matches/${matchId}/info`),
  // 채팅나가기
  leaveChat: (matchId) => api.post(`/matches/${matchId}/leave`),
}

// ── 6. AI 상담사(Support) API ─────────────────────
export const supportAPI = {
  getFaqs: () => api.get('/support/faqs'),
  getFaqAnswer: (faqId) => api.get(`/support/faqs/${faqId}`),
  askAi: (message) => api.post('/support/ask', { message }),
}
