import { EarnUSDC } from './components/EarnUSDC.js';

console.log('App initialization started');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    try {
        const root = document.getElementById('root');
        console.log('Root element:', root);
        
        const app = EarnUSDC();
        console.log('EarnUSDC component created');
        
        root.appendChild(app);
        console.log('Component mounted to DOM');
    } catch (error) {
        console.error('Initialization error:', error);
    }
});
