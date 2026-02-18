/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#05070A",        
        ink2: "#0B0F14",      
        line: "rgba(255,255,255,0.08)", 
        snow: "#F5F7FA",       
        mute: "rgba(245,247,250,0.72)", 
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.08), 0 12px 40px rgba(0,0,0,0.55)",
      },
    },
  },
  plugins: [],
};
