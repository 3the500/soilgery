import axios from 'axios'

// 💡 백엔드 클라우드 URL (Railway 24시간 백엔드 연결)
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://outstanding-celebration-production.up.railway.app'

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
  updateMe: (data) => api.put('/auth/me', data),
  getUsers: () => api.get('/auth/users'),
  // 🖼️ [피드백 반영] 프로필 사진 등록/삭제 (2~5MB 이하, jpeg/png/webp)
  uploadProfileImage: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/auth/me/profile-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  deleteProfileImage: () => api.delete('/auth/me/profile-image'),
}

// ── 2. 적성검사(Aptitude Test) API ────────────────
export const aptitudeAPI = {
  getQuestions: () => api.get('/aptitude-test/questions'),
  submitTest: (data) => api.post('/aptitude-test/submit', data),
  getMyStats: () => api.get('/aptitude-test/my-stats'),
  resetStats: () => api.post('/aptitude-test/reset'),
}

// ── 3. 매칭(Matching) API ─────────────────────────
export const matchingAPI = {
  getRecommendedTasks: (topN = 3) => api.get(`/users/me/recommended-task?top_n=${topN}`),
  requestMatch: () => api.post('/users/me/request-match'),
  cancelMatchRequest: () => api.post('/users/me/cancel-match-request'),
  getMyMatch: () => api.get('/users/me/match'),
  getMyMatches: () => api.get('/users/me/matches'),
  getCandidates: (postingId, useAi = true) => 
    api.get(`/job-postings/${postingId}/candidates?use_ai=${useAi}`),
  createMatch: (postingId, employeeId) => 
    api.post(`/job-postings/${postingId}/match`, { employee_id: employeeId }),
  getCandidatesByTask: (taskName) => 
    api.get(`/candidates/by-task/${encodeURIComponent(taskName)}`),
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
  getMatchInfo: (matchId) => api.get(`/matches/${matchId}/info`),
  leaveChat: (matchId) => api.post(`/matches/${matchId}/leave`),
  // 🖼️🎬 [피드백 반영] 채팅방 이미지/동영상 공유 (이미지 20MB, 동영상 300MB 이하)
  uploadFile: (matchId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/matches/${matchId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

// ── 6. AI 상담사(Support) API ─────────────────────
export const supportAPI = {
  getFaqs: () => api.get('/support/faqs'),
  getFaqAnswer: (faqId) => api.get(`/support/faqs/${faqId}`),
  askAi: (message) => api.post('/support/ask', { message }),
}

// ⭐️ 7. 평점 및 리뷰(Review) API ──────────────────
export const reviewAPI = {
  createReview: (data) => api.post('/reviews', data),
  getMyReviews: () => api.get('/reviews/my'),
}
