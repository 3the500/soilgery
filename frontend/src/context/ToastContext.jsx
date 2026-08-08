import React, { createContext, useContext, useState, useCallback } from 'react'
import styles from './Toast.module.css'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null) // { message, type: 'info' | 'success' | 'error' }

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 2800)
  }, [])

  const hideToast = () => setToast(null)

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className={styles.toastWrapper} onClick={hideToast}>
          <div className={`${styles.toastCard} ${styles[toast.type]}`}>
            <span className={styles.toastIcon}>
              {toast.type === 'success' ? '🎉' : toast.type === 'error' ? '⚠️' : '💡'}
            </span>
            <span className={styles.toastMessage}>{toast.message}</span>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    // fallback if used outside provider
    return { showToast: (msg) => console.log(msg) }
  }
  return context
}
