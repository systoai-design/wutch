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
  
  // Extract Twitter handle from URL
  let twitterHandle = '';
  if (creatorSocialLinks?.twitter) {
    const match = creatorSocialLinks.twitter.match(/twitter\.com\/([^/?]+)/i) || 
                  creatorSocialLinks.twitter.match(/x\.com\/([^/?]+)/i);
    if (match) {
      twitterHandle = match[1];
    }
  }
  
  let text = `Check out "${title}" by ${creatorName} on Wutch! 🎬`;
  
  // Add social links to the tweet
  if (twitterHandle) {
    text += `\n\nFollow the creator: @${twitterHandle}`;
  }
  if (creatorSocialLinks?.website) {
    text += `\n🌐 ${creatorSocialLinks.website}`;
  }
  
  const hashtags = "Wutch,Web3,Crypto,Shorts";
  
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${hashtags}`;
  
  window.open(twitterUrl, "_blank", "width=550,height=420");
};

export const shareStreamToTwitter = ({ id, title, creatorName, username, creatorSocialLinks }: ShareStreamParams) => {
  const url = username
    ? makeAbsoluteUrl(generateContentUrl('stream', { id, title, profiles: { username } }))
    : makeAbsoluteUrl(`/stream/${id}`);
  
  // Extract Twitter handle from URL
  let twitterHandle = '';
  if (creatorSocialLinks?.twitter) {
    const match = creatorSocialLinks.twitter.match(/twitter\.com\/([^/?]+)/i) || 
                  creatorSocialLinks.twitter.match(/x\.com\/([^/?]+)/i);
    if (match) {
      twitterHandle = match[1];
    }
  }
  
  let text = `Watch "${title}" by ${creatorName} live on Wutch! 🔴`;
  
  // Add social links to the tweet
  if (twitterHandle) {
    text += `\n\nFollow the creator: @${twitterHandle}`;
  }
  if (creatorSocialLinks?.website) {
    text += `\n🌐 ${creatorSocialLinks.website}`;
  }
  
  const hashtags = "Wutch,Web3,Crypto,Livestream";
  
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${hashtags}`;
  
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
  
  // Extract Twitter handle from URL
  let twitterHandle = '';
  if (creatorSocialLinks?.twitter) {
    const match = creatorSocialLinks.twitter.match(/twitter\.com\/([^/?]+)/i) || 
                  creatorSocialLinks.twitter.match(/x\.com\/([^/?]+)/i);
    if (match) {
      twitterHandle = match[1];
    }
  }
  
  let text = `Watch "${title}" by ${creatorName} on Wutch! 📺`;
  
  // Add social links to the tweet
  if (twitterHandle) {
    text += `\n\nFollow the creator: @${twitterHandle}`;
  }
  if (creatorSocialLinks?.website) {
    text += `\n🌐 ${creatorSocialLinks.website}`;
  }
  
  const hashtags = "Wutch,Web3,Crypto,Video";
  
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
