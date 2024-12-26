import { EarnUSDC } from './components/EarnUSDC.js';

document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('root');
    const app = EarnUSDC();
    root.appendChild(app);
});
