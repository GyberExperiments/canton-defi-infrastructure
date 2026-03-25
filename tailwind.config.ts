import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Сохраняем все кастомные CSS переменные из globals.css
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        
        // Liquid Prism Color Palette
        'liquid-violet': 'var(--liquid-violet)',
        'liquid-blue': 'var(--liquid-blue)',
        'liquid-cyan': 'var(--liquid-cyan)',
        'liquid-teal': 'var(--liquid-teal)',
        'liquid-emerald': 'var(--liquid-emerald)',
        
        // Secondary Warmth
        'warm-coral': 'var(--warm-coral)',
        'warm-amber': 'var(--warm-amber)',
        'warm-peach': 'var(--warm-peach)',
        'warm-rose': 'var(--warm-rose)',
        
        // Background System
        'bg-primary': 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'bg-tertiary': 'var(--bg-tertiary)',
        'bg-surface': 'var(--bg-surface)',
        
        // Semantic Colors
        success: 'var(--success)',
        warning: 'var(--warning)',
        error: 'var(--error)',
        info: 'var(--info)',
        
        // Input System Colors - централизованные цвета для input элементов
        'input-text': 'var(--input-text)',
        'input-placeholder': 'var(--input-placeholder)',
        'input-suffix': 'var(--input-suffix)',
        'input-border': 'var(--input-border)',
        'input-focus-border': 'var(--input-focus-border)',
        'input-on-dark-text': 'var(--input-on-dark-text)',
        'input-on-dark-suffix': 'var(--input-on-dark-suffix)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      fontSize: {
        'fluid-xs': 'var(--text-xs)',
        'fluid-sm': 'var(--text-sm)',
        'fluid-base': 'var(--text-base)',
        'fluid-lg': 'var(--text-lg)',
        'fluid-xl': 'var(--text-xl)',
        'fluid-2xl': 'var(--text-2xl)',
        'fluid-3xl': 'var(--text-3xl)',
        'fluid-4xl': 'var(--text-4xl)',
        'fluid-5xl': 'var(--text-5xl)',
        'fluid-6xl': 'var(--text-6xl)',
        'fluid-7xl': 'var(--text-7xl)',
        'fluid-8xl': 'var(--text-8xl)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
      },
      backgroundImage: {
        'gradient-sunset': 'var(--gradient-sunset)',
        'gradient-forest': 'var(--gradient-forest)',
        'gradient-twilight': 'var(--gradient-twilight)',
        'gradient-liquid': 'var(--gradient-liquid)',
        'gradient-holographic': 'var(--gradient-holographic)',
      },
      boxShadow: {
        'glow-violet': 'var(--glow-violet)',
        'glow-blue': 'var(--glow-blue)',
        'glow-cyan': 'var(--glow-cyan)',
        'glow-emerald': 'var(--glow-emerald)',
        'glow-multi': 'var(--glow-multi)',
      },
      backdropBlur: {
        xs: 'var(--glass-blur-sm)',
        sm: 'var(--glass-blur-md)',
        md: 'var(--glass-blur-lg)',
        lg: 'var(--glass-blur-xl)',
        xl: 'var(--glass-blur-2xl)',
      },
      animation: {
        'gradient-x': 'gradient-shift 3s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'glow-pulse': 'pulse-glow 2s ease-in-out infinite',
        'rotate-slow': 'rotate-slow 8s linear infinite',
        'mesh-flow': 'mesh-flow 20s ease-in-out infinite',
        'holographic-shift': 'holographic-shift 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
