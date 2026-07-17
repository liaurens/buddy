import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Nunito', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
            },
            colors: {
                cove: {
                    bg: '#e9f4f9',
                    backdrop: '#dcebf3',
                    ink: '#1d3a4d',
                    muted: '#5c86a0',
                    soft: '#7fa6bb',
                    faint: '#9cb9c9',
                    accent: '#4d9fd6',
                    'accent-light': '#7cc3e8',
                    'accent-pale': '#bfe2f5',
                    success: '#5cb586',
                    'success-deep': '#3d8a63',
                    streak: '#f2a541',
                    'streak-deep': '#e0862a',
                    'streak-text': '#c07a1e',
                    'tint-amber': '#fdeeda',
                    'tint-blue': '#e3f0fa',
                    'tint-green': '#e6f4ec',
                    'tint-purple': '#efe9f8',
                    purple: '#7a5fb0',
                    'tint-pink': '#fbe9ec',
                    pink: '#e8899a',
                    'pink-accent': '#f7b8c2',
                    track: '#d7e9f2',
                    border: '#c6dbe7',
                    'border-strong': '#bcd8e8',
                    overlay: '#1d3a4d',
                    'overlay-muted': '#a8cbde',
                },
            },
            borderRadius: {
                card: '18px',
                'card-lg': '20px',
                'card-xl': '22px',
                bubble: '18px 18px 18px 4px',
            },
            boxShadow: {
                cove: '0 3px 12px rgba(40, 90, 130, 0.09)',
                'cove-strong': '0 6px 18px rgba(40, 90, 130, 0.2)',
                'cove-nav': '0 -4px 16px rgba(40, 90, 130, 0.08)',
            },
            keyframes: {
                'cove-fadeslide': {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'cove-checkpop': {
                    '0%': { transform: 'scale(0.6)' },
                    '55%': { transform: 'scale(1.25)' },
                    '100%': { transform: 'scale(1)' },
                },
            },
            animation: {
                'cove-fadeslide': 'cove-fadeslide 0.35s ease',
                'cove-checkpop': 'cove-checkpop 0.4s ease',
            },
        },
    },
    plugins: [tailwindcssAnimate],
};
