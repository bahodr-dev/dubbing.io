import React from 'react';
import type { ActiveTab } from '../types';
import { Logo } from './Logo';

interface FooterProps {
  onNavigate: (tab: ActiveTab) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer style={{
      borderTop: 'var(--border-light)',
      backgroundColor: 'var(--c-white)',
      padding: '64px 0 48px',
      marginTop: 'auto',
    }}>
      <div className="container-xl">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '48px',
          marginBottom: '64px',
        }}>
          <div>
            <div 
              onClick={() => onNavigate('dashboard')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: '16px',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <Logo size={24} />
              <span style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.04em' }}>dubbing.io</span>
            </div>
            <p style={{
              fontSize: '14px',
              color: 'var(--black-60)',
              maxWidth: '320px',
              lineHeight: 1.6,
            }}>
              AI-powered video translation and dubbing. Upload your video, choose a language, and reach global audiences effortlessly.
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--black-40)', marginBottom: '16px' }}>
              Product
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li>
                <button onClick={() => onNavigate('dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--black-80)' }}>
                  Studio Dashboard
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('studio')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--black-80)' }}>
                  Voice Synthesis
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('pricing')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--black-80)' }}>
                  Pricing Plans
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('signup')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--black-80)' }}>
                  Create Account
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--black-40)', marginBottom: '16px' }}>
              Languages
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li style={{ fontSize: '14px', color: 'var(--black-80)' }}>Uzbek (O'zbek)</li>
              <li style={{ fontSize: '14px', color: 'var(--black-80)' }}>English (US / UK)</li>
              <li style={{ fontSize: '14px', color: 'var(--black-80)' }}>Spanish (Español)</li>
              <li style={{ fontSize: '14px', color: 'var(--black-80)' }}>German (Deutsch)</li>
              <li style={{ fontSize: '14px', color: 'var(--black-80)' }}>Japanese (日本語)</li>
            </ul>
          </div>

          <div>
            <h4 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--black-40)', marginBottom: '16px' }}>
              Legal & Trust
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <li style={{ fontSize: '14px', color: 'var(--black-80)' }}>Privacy Policy</li>
              <li style={{ fontSize: '14px', color: 'var(--black-80)' }}>Terms of Service</li>
              <li style={{ fontSize: '14px', color: 'var(--black-80)' }}>Security & API</li>
              <li style={{ fontSize: '14px', color: 'var(--black-80)' }}>Audio Copyright</li>
            </ul>
          </div>
        </div>

        <div style={{
          borderTop: 'var(--border-light)',
          paddingTop: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px',
          color: 'var(--black-40)',
        }}>
          <div>
            © {new Date().getFullYear()} dubbing.io Inc. All rights reserved.
          </div>
          <div className="mono" style={{ fontSize: '12px' }}>
            44.1 kHz / 24-bit Studio Neural Engine
          </div>
        </div>
      </div>
    </footer>
  );
};
