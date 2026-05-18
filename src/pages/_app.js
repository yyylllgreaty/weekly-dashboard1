// src/pages/_app.js
import '@/styles/globals.css';
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';

// ── Google OAuth Client ID ──
// You need to create one at https://console.cloud.google.com/apis/credentials
// Set this as an environment variable in Vercel: NEXT_PUBLIC_GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// ── Auth Gate Component ──
function AuthGate({ children }) {
  const [user, setUser] = useState(null);       // { email, name, picture }
  const [checking, setChecking] = useState(true); // initial load check
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('dashboard_user');
      if (saved) {
        setUser(JSON.parse(saved));
      }
    } catch (e) { /* ignore */ }
    setChecking(false);
  }, []);

  // Initialize Google Sign-In
  useEffect(() => {
    if (user || !GOOGLE_CLIENT_ID) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
        });
        window.google.accounts.id.renderButton(
          document.getElementById('google-signin-btn'),
          {
            theme: 'outline',
            size: 'large',
            width: 300,
            text: 'signin_with',
            shape: 'rectangular',
          }
        );
      }
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup if needed
    };
  }, [user]);

  const handleGoogleResponse = useCallback(async (response) => {
    if (!response.credential) {
      setError('Sign-in failed. Please try again.');
      return;
    }

    setSigningIn(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });

      const data = await res.json();

      if (res.ok && data.authorized) {
        setUser(data.user);
        sessionStorage.setItem('dashboard_user', JSON.stringify(data.user));
      } else {
        setError(data.message || data.error || 'Access denied.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSigningIn(false);
    }
  }, []);

  const handleSignOut = () => {
    setUser(null);
    sessionStorage.removeItem('dashboard_user');
    if (window.google) {
      window.google.accounts.id.disableAutoSelect();
    }
    // Reload to re-render Google button
    window.location.reload();
  };

  // Still checking session storage
  if (checking) return null;

  // Not logged in — show login screen
  if (!user) {
    return (
      <>
        <Head>
          <title>Lead Gen BUs Dashboard - Sign In</title>
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        </Head>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          fontFamily: 'Outfit, sans-serif',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '48px 40px',
            maxWidth: '420px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            {/* Logo */}
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: 22, fontWeight: 700, color: '#fff',
            }}>
              LG
            </div>

            <h1 style={{
              fontSize: '22px', fontWeight: 600, color: '#1a1a2e',
              margin: '0 0 8px',
            }}>
              Lead Gen BUs Dashboard
            </h1>

            <p style={{
              fontSize: '14px', color: '#6b7280', margin: '0 0 32px',
              lineHeight: 1.5,
            }}>
              Sign in with your company Google account to access the weekly performance dashboard.
            </p>

            {!GOOGLE_CLIENT_ID ? (
              <div style={{
                padding: '16px', borderRadius: '8px',
                background: '#fef2f2', color: '#dc2626',
                fontSize: '13px', lineHeight: 1.5,
              }}>
                Google Sign-In is not configured yet. The environment variable
                NEXT_PUBLIC_GOOGLE_CLIENT_ID needs to be set in Vercel.
              </div>
            ) : (
              <>
                {/* Google Sign-In button renders here */}
                <div id="google-signin-btn" style={{
                  display: 'flex', justifyContent: 'center', minHeight: 44,
                }} />

                {signingIn && (
                  <p style={{ fontSize: '14px', color: '#6b7280', marginTop: 16 }}>
                    Verifying access...
                  </p>
                )}
              </>
            )}

            {error && (
              <div style={{
                marginTop: 20, padding: '14px 16px', borderRadius: '8px',
                background: '#fef2f2', color: '#dc2626',
                fontSize: '13px', lineHeight: 1.5,
              }}>
                {error}
              </div>
            )}

            <p style={{
              fontSize: '12px', color: '#9ca3af', marginTop: 28,
              lineHeight: 1.5,
            }}>
              Access is restricted to authorized Internet Brands employees and partners.
            </p>
          </div>
        </div>
      </>
    );
  }

  // Logged in — render the dashboard with a user bar
  return (
    <>
      {children}
      {/* Floating user badge — bottom-right corner */}
      <div style={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
        background: '#fff', borderRadius: '28px',
        padding: '6px 14px 6px 6px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: 'Outfit, sans-serif',
        fontSize: '13px',
      }}>
        {user.picture ? (
          <img src={user.picture} alt="" style={{
            width: 28, height: 28, borderRadius: '50%',
          }} />
        ) : (
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: '#e5e7eb', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 600, color: '#6b7280',
          }}>
            {(user.name || user.email)[0].toUpperCase()}
          </div>
        )}
        <span style={{ color: '#374151' }}>
          {user.name || user.email}
        </span>
        <button
          onClick={handleSignOut}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9ca3af', fontSize: '12px', marginLeft: 4,
            padding: '2px 6px', borderRadius: 4,
          }}
          onMouseEnter={(e) => e.target.style.color = '#ef4444'}
          onMouseLeave={(e) => e.target.style.color = '#9ca3af'}
        >
          Sign out
        </button>
      </div>
    </>
  );
}

// ── Main App ──
export default function App({ Component, pageProps }) {
  return (
    <AuthGate>
      <Component {...pageProps} />
    </AuthGate>
  );
}
