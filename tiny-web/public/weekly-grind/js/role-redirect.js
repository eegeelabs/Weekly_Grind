// role-redirect.js - Redirect users to appropriate pages based on role
// Include this on the main landing page or after login

(async function() {
  'use strict';

  // Don't redirect if already on a specific page
  const currentPath = window.location.pathname;
  const noRedirectPaths = [
    '/weekly-grind/view',
    '/weekly-grind/projects',
    '/weekly-grind/repair-reimage',
    '/weekly-grind/scheduling',
    '/weekly-grind/supervisor-dashboard',
    '/weekly-grind/manager-dashboard',
    '/weekly-grind/admin-options',
    '/weekly-grind/users',
    '/weekly-grind/admin/stage-timeframes'
  ];

  // If already on a specific page, don't redirect
  if (noRedirectPaths.some(path => currentPath.includes(path))) {
    return;
  }

  try {
    const response = await fetch('/auth/me', { credentials: 'include' });
    
    if (!response.ok) {
      // Not authenticated, redirect to login
      window.location.href = '/weekly-grind/login';
      return;
    }

    const user = await response.json();
    
    // Role-based redirects
    if (user.role === 'tech') {
      // Techs go to Schedule View
      window.location.href = '/weekly-grind/view';
      
    } else if (user.role === 'coordinator') {
      // Coordinators go to Projects
      window.location.href = '/weekly-grind/projects';
      
    } else if (user.role === 'supervisor') {
      // Supervisors go to their dashboard
      window.location.href = '/weekly-grind/supervisor-dashboard';
      
    } else if (user.role === 'manager') {
      // Managers go to their dashboard
      window.location.href = '/weekly-grind/manager-dashboard';
      
    } else if (user.role === 'admin' && user.is_admin) {
      // Admin-only users (no functional role) go to Admin Options
      window.location.href = '/weekly-grind/admin-options';
      
    } else {
      // Default fallback
      window.location.href = '/weekly-grind/view';
    }
    
  } catch (error) {
    console.error('Role redirect error:', error);
    // On error, go to login
    window.location.href = '/weekly-grind/login';
  }
})();
