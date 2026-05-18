// Age verification gate — required before entering Organic Vegas.
// Stores consent in sessionStorage (clears on tab close).

import React, { useState } from 'react';

const SESSION_KEY = 'ov_age_verified';

export function isAgeVerified(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

interface Props {
  onVerified: () => void;
}

export default function AgeGate({ onVerified }: Props) {
  const [rejected, setRejected] = useState(false);

  const handleYes = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    onVerified();
  };

  const handleNo = () => {
    setRejected(true);
  };

  if (rejected) {
    return (
      <div style={styles.root}>
        <div style={styles.card}>
          <div style={styles.skull}>⚠</div>
          <div style={styles.title}>ACCESS DENIED</div>
          <div style={styles.sub}>
            You must be 18 or older to enter Organic Vegas.
          </div>
          <div style={{ ...styles.sub, marginTop: 24, fontSize: 10, opacity: 0.5 }}>
            This is a simulated game experience. No real money is wagered.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <div style={styles.skull}>☠</div>

        <div style={styles.title}>ORGANIC VEGAS</div>
        <div style={styles.gameName}>FARKLE FRENZY</div>

        <div style={styles.divider} />

        <div style={styles.warning}>AGE VERIFICATION REQUIRED</div>
        <div style={styles.body}>
          This experience contains simulated gambling mechanics and is intended
          for adults aged <span style={{ color: '#c9a84c', fontWeight: 700 }}>18 and over</span>.
          No real money is used or wagered.
        </div>

        <div style={styles.question}>Are you 18 years of age or older?</div>

        <div style={styles.btnRow}>
          <button style={{ ...styles.btn, ...styles.btnYes }} onClick={handleYes}>
            YES — I AM 18+
          </button>
          <button style={{ ...styles.btn, ...styles.btnNo }} onClick={handleNo}>
            NO
          </button>
        </div>

        <div style={styles.footnote}>
          By entering you confirm you have read and agree to the Terms of Service.
          This platform does not accept wagers or distribute real prizes.
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    width: '100vw',
    height: '100dvh',
    background: '#05030a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    color: '#f0e6c8',
    backgroundImage: `
      radial-gradient(ellipse at 20% 50%, rgba(26,14,58,0.6) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 50%, rgba(13,31,58,0.6) 0%, transparent 60%)
    `,
  },
  card: {
    maxWidth: 420,
    width: '90%',
    background: 'rgba(14,8,24,0.95)',
    border: '1px solid rgba(201,168,76,0.35)',
    borderRadius: 12,
    padding: '36px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0,
    boxShadow: '0 0 60px rgba(201,168,76,0.08), inset 0 1px 0 rgba(201,168,76,0.15)',
  },
  skull: {
    fontSize: 48,
    lineHeight: 1,
    marginBottom: 16,
    filter: 'drop-shadow(0 0 12px rgba(201,168,76,0.6))',
  },
  title: {
    fontSize: 11,
    letterSpacing: '0.3em',
    color: '#8a7550',
    marginBottom: 4,
  },
  gameName: {
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: '0.15em',
    color: '#c9a84c',
    textShadow: '0 0 20px rgba(201,168,76,0.5)',
    marginBottom: 24,
    fontFamily: "'Cinzel', 'Palatino Linotype', serif",
  },
  divider: {
    width: '100%',
    height: 1,
    background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.4), transparent)',
    marginBottom: 24,
  },
  warning: {
    fontSize: 10,
    letterSpacing: '0.25em',
    color: '#c9a84c',
    marginBottom: 12,
  },
  body: {
    fontSize: 13,
    lineHeight: 1.7,
    textAlign: 'center',
    color: '#a89878',
    marginBottom: 20,
  },
  question: {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#f0e6c8',
    marginBottom: 20,
  },
  btnRow: {
    display: 'flex',
    gap: 12,
    width: '100%',
    marginBottom: 20,
  },
  btn: {
    flex: 1,
    padding: '14px 0',
    border: 'none',
    borderRadius: 6,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.1em',
    cursor: 'pointer',
    transition: 'opacity 0.15s, box-shadow 0.15s',
  },
  btnYes: {
    background: 'linear-gradient(135deg, #c9a84c 0%, #7a5f20 100%)',
    color: '#05030a',
    boxShadow: '0 0 20px rgba(201,168,76,0.3)',
  },
  btnNo: {
    background: 'rgba(255,255,255,0.05)',
    color: '#8a7550',
    border: '1px solid rgba(138,117,80,0.3)',
  },
  footnote: {
    fontSize: 9,
    color: '#4a3f30',
    textAlign: 'center',
    lineHeight: 1.6,
    letterSpacing: '0.05em',
  },
};
