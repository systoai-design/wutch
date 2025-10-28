export function formatFollowerCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatSolToUsd(
  solAmount: number, 
  solPrice: number,
  options?: {
    showSol?: boolean;
    showUsd?: boolean;
    decimals?: number;
  }
): string {
  const { 
    showSol = true, 
    showUsd = true, 
    decimals = 2 
  } = options || {};
  
  const usdAmount = solAmount * solPrice;
  
  if (showSol && showUsd) {
    // For small SOL amounts (< 1 SOL), show SOL first
    if (solAmount < 1) {
      return `${solAmount.toFixed(4)} SOL ($${usdAmount.toFixed(decimals)})`;
    }
    // For large amounts, show USD first
    return `$${usdAmount.toLocaleString('en-US', { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    })} (${solAmount.toFixed(2)} SOL)`;
  }
  
  if (showUsd) {
    return `$${usdAmount.toLocaleString('en-US', { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    })}`;
  }
  
  return `${solAmount.toFixed(4)} SOL`;
}
