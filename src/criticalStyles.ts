// Critical CSS to be inlined in the head for faster initial render
export const criticalCSS = `
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
  }
  
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
  }
  
  * {
    border-color: hsl(var(--border));
  }
  
  body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    margin: 0;
    padding: 0;
  }
  
  #root {
    min-height: 100vh;
  }
  
  .animate-fade-in-up {
    animation: fadeInUp 0.3s ease-out;
  }
  
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
