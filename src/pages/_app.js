// src/pages/_app.js
import '@/styles/globals.css';
import { useState, useEffect } from 'react';
import Head from 'next/head';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  useEffect(function checkSession() {
    try {
      var saved = sessionStorage.getItem('dashboard_user');
      if (saved) setUser(JSON.parse(saved));
    } catch (e) { /* ignore */ }
    setChecking(false);
  }, []);

  useEffect(function loadGoogleScript() {
    if (user || !GOOGLE_CLIENT_ID) return;

    function handleCredential(response) {
      if (!response.credential) {
        setError('Sign-in failed. Please try again.');
        return;
      }
      setSigningIn(true);
      setError('');
      fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (result.ok && result.data.authorized) {
            setUser(result.data.user);
            sessionStorage.setItem('dashboard_user', JSON.stringify(result.data.user));
          } else {
            setError(result.data.message || result.data.error || 'Access denied.');
          }
        })
        .catch(function () { setError('Network error. Please try again.'); })
        .finally(function () { setSigningIn(false); });
    }

    var script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = function () {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredential,
        });
        var btn = document.getElementById('google-signin-btn');
        if (btn) {
          window.google.accounts.id.renderButton(btn, {
            theme: 'outline',
            size: 'large',
            width: 300,
            text: 'signin_with',
            shape: 'rectangular',
          });
        }
      }
    };
    document.head.appendChild(script);
  }, [user]);

  function handleSignOut() {
    setUser(null);
    sessionStorage.removeItem('dashboard_user');
    if (window.google) {
      window.google.accounts.id.disableAutoSelect();
    }
    window.location.reload();
  }

  if (checking) return null;

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
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: 22, fontWeight: 700, color: '#fff',
            }}>
              LG
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#1a1a2e', margin: '0 0 8px' }}>
              Lead Gen BUs Dashboard
            </h1>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 32px', lineHeight: 1.5 }}>
              Sign in with your company Google account to access the weekly performance dashboard.
            </p>
            {!GOOGLE_CLIENT_ID ? (
              <div style={{
                padding: '16px', borderRadius: '8px',
                background: '#fef2f2', color: '#dc2626',
                fontSize: '13px', lineHeight: 1.5,
              }}>
                Google Sign-In is not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in Vercel environment variables.
              </div>
            ) : (
              <>
                <div id="google-signin-btn" style={{ display: 'flex', justifyContent: 'center', minHeight: 44 }} />
                {signingIn && (
                  <p style={{ fontSize: '14px', color: '#6b7280', marginTop: 16 }}>Verifying access...</p>
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
            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: 28, lineHeight: 1.5 }}>
              Access is restricted to authorized Internet Brands employees and partners.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {children}
      <div style={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
        background: '#fff', borderRadius: '28px',
        padding: '6px 14px 6px 6px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: 'Outfit, sans-serif', fontSize: '13px',
      }}>
        {user.picture ? (
          <img src={user.picture} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} referrerPolicy="no-referrer" />
        ) : (
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: '#e5e7eb', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 600, color: '#6b7280',
          }}>
            {(user.name || user.email || '?')[0].toUpperCase()}
          </div>
        )}
        <span style={{ color: '#374151' }}>{user.name || user.email}</span>
        <button
          onClick={handleSignOut}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9ca3af', fontSize: '12px', marginLeft: 4,
            padding: '2px 6px', borderRadius: 4,
          }}
        >
          Sign out
        </button>
      </div>
    </>
  );
}

export default function App({ Component, pageProps }) {
  return (
    <AuthGate>
      <Component {...pageProps} />
    </AuthGate>
  );
}
