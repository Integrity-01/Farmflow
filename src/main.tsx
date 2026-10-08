import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

import { ApiError } from '@/services/api';
import { onQueueFlushed, startSyncLoop } from '@/pwa/sync';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'always',
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.code !== 'NETWORK_ERROR') return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 15_000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 5 * 60_000,
      gcTime: 10 * 60_000,
    },
  },
});

startSyncLoop();
onQueueFlushed(() => {
  void queryClient.invalidateQueries({ queryKey: ['tasks'] });
});

window.addEventListener('online', () => {
  void queryClient.invalidateQueries();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);