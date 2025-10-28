import { useState, useEffect } from 'react';

export const useSolPrice = () => {
  const [solPrice, setSolPrice] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchSolPrice = async () => {
      try {
        setIsLoading(true);
        // CoinGecko free API - no auth needed
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
        );
        
        if (!response.ok) throw new Error('Failed to fetch SOL price');
        
        const data = await response.json();
        const price = data.solana?.usd || 0;
        
        setSolPrice(price);
        setError(null);
      } catch (err) {
        console.error('Error fetching SOL price:', err);
        setError(err as Error);
        setSolPrice(0); // Fallback
      } finally {
        setIsLoading(false);
      }
    };

    fetchSolPrice();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchSolPrice, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  return { solPrice, isLoading, error };
};
