import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const NAV_ITEMS = [
  { label: 'SlotGen', path: '/', icon: '⚡' },
  { label: 'ConceptForge', path: '/concept-forge', icon: '🔥' },
  { label: 'MusicEngine', path: '/music-engine', icon: '🎵' },
];

const AGROSLayout: React.FC = () => {
  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', color: '#E2E8F0', fontFamily: 'system-ui, sans-serif' }}>
      {/* Top Navigation */}
      <nav style={{
        background: '#12172B',
        borderBottom: '1px solid #1E293B',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        height: 48,
        gap: 4,
      }}>
        <span style={{
          color: '#22D3EE',
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 700,
          fontSize: 14,
          marginRight: 24,
        }}>
          AGROS
        </span>
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            style={({ isActive }) => ({
              color: isActive ? '#22D3EE' : '#64748B',
              background: isActive ? 'rgba(34,211,238,0.1)' : 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid #22D3EE' : '2px solid transparent',
              padding: '12px 16px',
              fontSize: 13,
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              transition: 'color 0.15s, background 0.15s',
            })}
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Page Content */}
      <Outlet />
    </div>
  );
};

export default AGROSLayout;
