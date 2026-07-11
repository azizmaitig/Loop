import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoopStreamProvider } from './hooks/useLoopStream';
import { TopBar } from './components/TopBar';
import { TabNav, type ScreenId } from './components/TabNav';
import { OpsHealthScreen } from './screens/OpsHealthScreen';
import { DiagnosticScreen } from './screens/DiagnosticScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  const [screen, setScreen] = useState<ScreenId>('ops');

  return (
    <QueryClientProvider client={queryClient}>
      <LoopStreamProvider>
        <div className="app-shell">
          <TopBar />
          <TabNav active={screen} onChange={setScreen} />
          <main className="app-main">
            {screen === 'ops' ? <OpsHealthScreen /> : <DiagnosticScreen />}
          </main>
        </div>
      </LoopStreamProvider>
    </QueryClientProvider>
  );
}
