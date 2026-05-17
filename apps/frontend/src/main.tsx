import React from 'react';
import { createRoot } from 'react-dom/client';
import { injectTheme } from '../../../packages/dream-core/src/ThemeRegistry';
import App from './App';

injectTheme();

const container = document.getElementById('root')!;
createRoot(container).render(<App />);
