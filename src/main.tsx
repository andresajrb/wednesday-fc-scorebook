import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { HydrationBoundary } from '@/components/HydrationBoundary';
import { startCloudSync } from '@/sync/useCloud';
import './index.css';

startCloudSync();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HydrationBoundary>
      <App />
    </HydrationBoundary>
  </React.StrictMode>
);
