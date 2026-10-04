import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/workspace.css';
import './styles/viz.css';
import './styles/subjects.css';
import { App } from './App';
import { boot } from './boot';
import { registerPwa } from './lib/pwa';
import { initTheme } from './lib/theme';

initTheme();

const root = document.getElementById('root');
if (!root) throw new Error('Mangler #root');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

void boot();
registerPwa();
