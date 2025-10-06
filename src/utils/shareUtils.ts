import { generateContentUrl } from './urlHelpers';

interface ShareShortParams {
  id: string;
  title: string;
  creatorName: string;
  username?: string;
}

interface ShareStreamParams {
  id: string;
  title: string;
  creatorName: string;
  username?: string;
}

export const shareShortToTwitter = ({ id, title, creatorName, username }: ShareShortParams) => {
  const url = username 
    ? `${window.location.origin}${generateContentUrl('shorts', { id, title, profiles: { username } })}`
    : `${window.location.origin}/shorts?id=${id}`;
  const text = `Check out "${title}" by ${creatorName} on Wutch! 🎬`;
  const hashtags = "Wutch,Web3,Crypto,Shorts";
  
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${hashtags}`;
  
  window.open(twitterUrl, "_blank", "width=550,height=420");
};

export const shareStreamToTwitter = ({ id, title, creatorName, username }: ShareStreamParams) => {
  const url = username
    ? `${window.location.origin}${generateContentUrl('stream', { id, title, profiles: { username } })}`
    : `${window.location.origin}/stream/${id}`;
  const text = `Watch "${title}" by ${creatorName} live on Wutch! 🔴`;
  const hashtags = "Wutch,Web3,Crypto,Livestream";
  
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${hashtags}`;
  
  window.open(twitterUrl, "_blank", "width=550,height=420");
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
};
