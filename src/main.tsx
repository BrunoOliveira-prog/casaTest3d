import { createRoot } from 'react-dom/client';
import './styles/app.css';
import { App } from './app/App';

import { useStore } from './state/store';

// gancho de depuração opcional (?debug) usado nos testes visuais
if (new URLSearchParams(location.search).has('debug')) (window as unknown as { __raiox: typeof useStore }).__raiox = useStore;

createRoot(document.getElementById('root')!).render(<App />);
