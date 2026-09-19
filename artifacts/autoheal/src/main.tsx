import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import './index.css';

setBaseUrl(import.meta.env.VITE_API_BASE_URL || null);

function AuthTokenBridge() {
  const { getToken } = useAuth();

  setAuthTokenGetter(getToken);

  return null;
}

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
    <AuthTokenBridge />
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </ClerkProvider>,
);