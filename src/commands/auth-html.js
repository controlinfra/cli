'use strict';

/**
 * HTML templates for browser-based auth callback pages
 */

/**
 * Success HTML page shown in browser after auth
 */
function getSuccessHtml() {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Controlinfra - Login Successful</title>
  <link rel="icon" href="https://d11ycnukdvjoh1.cloudfront.net/icons/favicon.svg">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f8fafc;
    }
    .container {
      text-align: center;
      background: white;
      padding: 3rem;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      border: 1px solid #e2e8f0;
      max-width: 400px;
      width: 90%;
    }
    .logo {
      width: 48px;
      height: 48px;
      margin-bottom: 1.5rem;
    }
    .success-icon {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
    }
    .success-icon svg {
      width: 32px;
      height: 32px;
      color: white;
    }
    h1 {
      color: #1e293b;
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0 0 0.5rem;
    }
    p {
      color: #64748b;
      margin: 0;
      font-size: 0.938rem;
      line-height: 1.5;
    }
    .terminal-hint {
      margin-top: 1.5rem;
      padding: 0.75rem 1rem;
      background: #f1f5f9;
      border-radius: 8px;
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      font-size: 0.813rem;
      color: #475569;
    }
    .close-hint {
      margin-top: 1.5rem;
      font-size: 0.813rem;
      color: #94a3b8;
    }
    .brand {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      color: #64748b;
      font-size: 0.813rem;
    }
    .brand svg {
      width: 20px;
      height: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="success-icon">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
      </svg>
    </div>
    <h1>Authentication Successful</h1>
    <p>You've been logged in to Controlinfra CLI.</p>
    <div class="terminal-hint">Return to your terminal to continue</div>
    <p class="close-hint">This window will close automatically...</p>
    <div class="brand">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
      Controlinfra
    </div>
  </div>
  <script>setTimeout(() => window.close(), 3000);</script>
</body>
</html>`;
}

/**
 * Error HTML page shown in browser on auth failure
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getErrorHtml(error) {
  const safeError = escapeHtml(error);
  return `<!DOCTYPE html>
<html>
<head>
  <title>Controlinfra - Login Failed</title>
  <link rel="icon" href="https://d11ycnukdvjoh1.cloudfront.net/icons/favicon.svg">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #f8fafc;
    }
    .container {
      text-align: center;
      background: white;
      padding: 3rem;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      border: 1px solid #e2e8f0;
      max-width: 400px;
      width: 90%;
    }
    .error-icon {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem;
    }
    .error-icon svg {
      width: 32px;
      height: 32px;
      color: white;
    }
    h1 {
      color: #1e293b;
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0 0 0.5rem;
    }
    p {
      color: #64748b;
      margin: 0;
      font-size: 0.938rem;
      line-height: 1.5;
    }
    .error-message {
      margin-top: 1rem;
      padding: 0.75rem 1rem;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      font-size: 0.813rem;
      color: #b91c1c;
    }
    .retry-hint {
      margin-top: 1.5rem;
      font-size: 0.813rem;
      color: #94a3b8;
    }
    .retry-hint code {
      background: #f1f5f9;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, 'Courier New', monospace;
      color: #475569;
    }
    .brand {
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      color: #64748b;
      font-size: 0.813rem;
    }
    .brand svg {
      width: 20px;
      height: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </div>
    <h1>Authentication Failed</h1>
    <p>We couldn't complete your login.</p>
    <div class="error-message">${safeError}</div>
    <p class="retry-hint">Run <code>controlinfra login</code> to try again</p>
    <div class="brand">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
      Controlinfra
    </div>
  </div>
</body>
</html>`;
}

module.exports = { getSuccessHtml, getErrorHtml };
