import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme } from './theme';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root nao encontrado no index.html');

applyTheme();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
