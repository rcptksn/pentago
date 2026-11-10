import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const blockZoom = (event: Event) => event.preventDefault();
document.addEventListener('gesturestart', blockZoom);
document.addEventListener('gesturechange', blockZoom);
document.addEventListener('gestureend', blockZoom);

createRoot(document.getElementById('root')!).render(<App />);
