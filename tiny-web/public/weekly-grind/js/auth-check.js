// auth-check.js - Reusable authentication checking for Weekly Grind pages
// FIXED: Removed duplicate user info injection (handled by unified header)

(function() {
  'use strict';

  let currentUser = null;

  /**
   * Check if user is authenticated
   * Redirects to login page if not authenticated
   */
  async function checkAuth() {
    try {
      const res = await fetch('/auth/me');
      
      if (res.ok) {
        const user = await res.json();
        currentUser = user;
        return user;
      } else {
        // Not authenticated, redirect to login
        const currentPath = window.location.pathname + window.location.search;
        window.location.href = `/weekly-grind/login?redirect=${encodeURIComponent(currentPath)}`;
        return null;
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      // On error, redirect to login
      const currentPath = window.location.pathname + window.location.search;
      window.location.href = `/weekly-grind/login?redirect=${encodeURIComponent(currentPath)}`;
      return null;
    }
  }

  /**
   * Get current logged-in user
   */
  function getCurrentUser() {
    return currentUser;
  }

  /**
   * Logout user
   */
  async function logout() {
    try {
      await fetch('/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    }
    window.location.href = '/weekly-grind/login';
  }

  /**
   * Add user info and logout button to page header
   * DEPRECATED: User info is now handled by unified header component
   * This function is kept for backward compatibility but does nothing
   */
  function addUserInfoToHeader() {
    // Do nothing - unified header handles this now
    return;
  }

  /**
   * Initialize auth on page load
   */
  async function initAuth() {
    const user = await checkAuth();
    // Removed: addUserInfoToHeader() - no longer needed with unified header
    return user;
  }

  // Export functions to global scope
  window.WeeklyGrindAuth = {
    checkAuth,
    getCurrentUser,
    logout,
    initAuth
  };

  // Auto-initialize if not on login page
  if (!window.location.pathname.includes('/login')) {
    document.addEventListener('DOMContentLoaded', initAuth);
  }

})();
