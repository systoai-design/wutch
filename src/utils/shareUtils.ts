import { generateContentUrl } from './urlHelpers';
import { makeAbsoluteUrl } from './appUrl';

interface ShareShortParams {
  id: string;
  title: string;
  creatorName: string;
  username?: string;
  creatorSocialLinks?: { twitter?: string; website?: string; [key: string]: any };
}

interface ShareStreamParams {
  id: string;
  title: string;
  creatorName: string;
  username?: string;
  creatorSocialLinks?: { twitter?: string; website?: string; [key: string]: any };
}

export const shareShortToTwitter = ({ id, title, creatorName, username, creatorSocialLinks }: ShareShortParams) => {
  const url = username 
    ? makeAbsoluteUrl(generateContentUrl('shorts', { id, title, profiles: { username } }))
    : makeAbsoluteUrl(`/shorts?id=${id}`);
  
  const text = `"Wutch"\n\nThe First Platform to Reward even the Wutchers on Wutch! 📺 Earn crypto while watching!\n\nFollow the creator: @wutchdotfun\n\nWebsite: https://wutch.fun/`;
  
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  
  window.open(twitterUrl, "_blank", "width=550,height=420");
};

export const shareStreamToTwitter = ({ id, title, creatorName, username, creatorSocialLinks }: ShareStreamParams) => {
  const url = username
    ? makeAbsoluteUrl(generateContentUrl('stream', { id, title, profiles: { username } }))
    : makeAbsoluteUrl(`/stream/${id}`);
  
  const text = `"Wutch"\n\nThe First Platform to Reward even the Wutchers on Wutch! 📺 Earn crypto while watching!\n\nFollow the creator: @wutchdotfun\n\nWebsite: https://wutch.fun/`;
  
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  
  window.open(twitterUrl, "_blank", "width=550,height=420");
};

interface ShareWutchVideoParams {
  id: string;
  title: string;
  creatorName: string;
  username?: string;
  creatorSocialLinks?: { twitter?: string; website?: string; [key: string]: any };
}

export const shareWutchVideoToTwitter = ({ id, title, creatorName, username, creatorSocialLinks }: ShareWutchVideoParams) => {
  const url = username 
    ? makeAbsoluteUrl(generateContentUrl('wutch', { id, title, profiles: { username } }))
    : makeAbsoluteUrl(`/video/${id}`);
  
  const text = `"Wutch"\n\nThe First Platform to Reward even the Wutchers on Wutch! 📺 Earn crypto while watching!\n\nFollow the creator: @wutchdotfun\n\nWebsite: https://wutch.fun/`;
  
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  
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
