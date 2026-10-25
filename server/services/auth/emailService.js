import { logEvent } from '../logger.js';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function sendPasswordResetEmail({ to, resetUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'dubla.uz <noreply@dubla.uz>';

  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email delivery is not configured.');
    }
    logEvent('development_password_reset_link', { email: to, developmentResetLink: resetUrl });
    return { provider: 'development-log' };
  }

  const safeUrl = escapeHtml(resetUrl);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Reset your dubla.uz password',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#111827">
          <h1 style="font-size:24px">Reset your password</h1>
          <p>Use the button below to choose a new password. This link expires in 30 minutes.</p>
          <p style="margin:28px 0"><a href="${safeUrl}" style="background:#000;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none">Reset password</a></p>
          <p style="font-size:13px;color:#6b7280">If you did not request this change, you can ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(`Email provider rejected the request (${response.status}).`);
  }
  return response.json();
}
