import React from 'react';
import { AuthProvider } from './api/hooks/useAuth';
import { ConnectionTest } from './components/ConnectionTest';

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <h1>Study Planner App</h1>
        
        {/* Test backend connection */}
        <ConnectionTest />
        
        {/* Your app components */}
      </div>
    </AuthProvider>
  );
}

export default App;
