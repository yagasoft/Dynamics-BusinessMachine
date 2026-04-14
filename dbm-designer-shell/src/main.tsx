import ReactDOM from 'react-dom/client';
import { App } from './App';

const mountNode = document.getElementById('root') ?? (() => {
  const element = document.createElement('div');
  element.id = 'root';
  document.body.appendChild(element);
  return element;
})();

ReactDOM.createRoot(mountNode).render(<App />);
