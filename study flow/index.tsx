import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import DailyDay from './DailyDay';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");

const params = new URLSearchParams(window.location.search);
const showDailyDay = params.get('app') === 'dailyday';

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    {showDailyDay ? <DailyDay /> : <App />}
  </React.StrictMode>
);
