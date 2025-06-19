// src/main.tsx - Fixed version
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Debug logging
console.log('🚀 Starting CineStudy Frontend...');
console.log('📍 API Base URL:', import.meta.env.VITE_API_BASE_URL);
console.log('🔧 Environment:', import.meta.env.MODE);

// Get root element
const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('❌ Root element not found! Check your index.html');
} else {
  console.log('✅ Root element found, rendering app...');
  
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  
  console.log('✅ App rendered successfully!');
}