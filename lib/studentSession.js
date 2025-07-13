/**
 * Client-side session management utilities
 * These functions handle session storage in the browser
 * No server-side dependencies or imports
 */

/**
 * Store session data with optional persistence
 * @param {Object} sessionData - Session data to store
 * @param {boolean} persist - Whether to persist across browser sessions
 */
export function storeSessionData(sessionData, persist = false) {
  const storage = persist ? localStorage : sessionStorage;
  storage.setItem('studentData', JSON.stringify(sessionData));
}

/**
 * Retrieve session data from available storage
 * @returns {Object|null} Session data if exists
 */
export function retrieveSessionData() {
  // Check sessionStorage first (current session)
  let data = sessionStorage.getItem('studentData');
  if (data) return JSON.parse(data);
  
  // Check localStorage for persistent session
  data = localStorage.getItem('studentData');
  if (data) {
    const parsed = JSON.parse(data);
    // Validate session hasn't expired
    if (new Date(parsed.expiresAt) > new Date()) {
      // Move to sessionStorage for this session
      sessionStorage.setItem('studentData', data);
      return parsed;
    } else {
      // Clean up expired persistent session
      localStorage.removeItem('studentData');
    }
  }
  
  return null;
}

/**
 * Clear session data from all storage
 */
export function clearSessionData() {
  sessionStorage.removeItem('studentData');
  localStorage.removeItem('studentData');
}

/**
 * Check if session is close to expiry
 * @param {string} expiresAt - Session expiry timestamp
 * @returns {Object} Expiry status info
 */
export function checkSessionExpiry(expiresAt) {
  if (!expiresAt) return { isExpiring: false, minutesLeft: null };
  
  const now = new Date();
  const expiry = new Date(expiresAt);
  const minutesLeft = (expiry - now) / (1000 * 60);
  
  return {
    isExpiring: minutesLeft < 5 && minutesLeft > 0,
    minutesLeft: minutesLeft,
    daysLeft: minutesLeft / (60 * 24),
    shouldRefresh: minutesLeft < (2 * 24 * 60) && minutesLeft > 0 // Less than 2 days
  };
}