import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '../styles/theme.css';
import './dashboard.css';

let rootElement = document.getElementById('app-root');
if (!rootElement) {
  rootElement = document.createElement('div');
  rootElement.id = 'app-root';
  document.body.appendChild(rootElement);
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
