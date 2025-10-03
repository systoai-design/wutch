# StreamHub Backend API Documentation

## Overview
Your Pump.fun livestream aggregator now has a fully functional backend powered by Lovable Cloud with Solana integration.

## 🗄️ Database Schema

### Tables Created:
- **profiles** - User profiles with wallet addresses and stats
- **livestreams** - Pump.fun stream metadata with live status
- **short_videos** - Short-form content similar to YouTube Shorts
- **donations** - Solana transaction records with verification
- **comments** - User comments on streams and shorts
- **follows** - Social following relationships
- **short_video_likes** - Like tracking for shorts

### Key Features:
- Row Level Security (RLS) enabled on all tables
- Automatic timestamp updates
- Follower/like count triggers
- Profile auto-creation on signup
- Indexed for performance

## 🔐 Authentication

Email/password authentication is configured with:
- Auto-confirmed emails (no verification needed for testing)
- JWT-based session management
- Protected routes requiring authentication
- Automatic profile creation on signup

**Login/Signup:** Navigate to `/auth`

## 🚀 API Endpoints (Edge Functions)

### 1. Verify Donation (`/verify-donation`)
**POST** - Verifies Solana transactions on-chain

```typescript
POST https://vsjldzfoneoofvntjjcl.supabase.co/functions/v1/verify-donation

Body: {
  transactionSignature: string,
  donorWallet: string,
  recipientUserId: string,
  contentId: string,
  contentType: 'livestream' | 'shortvideo',
  amount: number,
  message?: string
}
```

- Connects to Solana mainnet
- Verifies transaction exists and is confirmed
- Validates wallet addresses match
- Records donation in database
- Updates total donation amounts

### 2. Livestreams (`/livestreams`)
**GET, POST, PUT, DELETE** - Manage livestreams

```typescript
// List livestreams with filters
GET /livestreams?filter=live&category=Trading&page=1&limit=20

// Get single livestream
GET /livestreams/{id}

// Create livestream (requires auth)
POST /livestreams
Body: {
  pumpFunUrl: string,
  title: string,
  description: string,
  thumbnailUrl: string,
  category: string,
  tags: string[]
}

// Update livestream (requires auth, own streams only)
PUT /livestreams/{id}

// Delete livestream (requires auth, own streams only)
DELETE /livestreams/{id}
```

### 3. Search (`/search`)
**GET** - Search across livestreams, shorts, and users

```typescript
GET /search?q=crypto&type=all
// type: 'all' | 'livestreams' | 'shorts' | 'users'
```

## 🔗 Direct Database Access

You can also query tables directly using the Supabase client:

```typescript
import { supabase } from '@/integrations/supabase/client';

// Get live streams
const { data } = await supabase
  .from('livestreams')
  .select('*, profiles(*)')
  .eq('is_live', true);

// Create donation
const { data } = await supabase
  .from('donations')
  .insert({ ... });
```

## 💰 Solana Integration

The donation verification endpoint:
1. Connects to Solana mainnet
2. Fetches the transaction by signature
3. Verifies transaction is confirmed (no errors)
4. Checks transaction involves correct donor and recipient wallets
5. Records donation with 'confirmed' status
6. Updates total donation amounts

**Important:** Currently configured for Solana mainnet. For testing, update the RPC URL to devnet in the verify-donation edge function.

## 🛡️ Security Features

- JWT authentication required for most operations
- RLS policies ensure users can only modify their own content
- Wallet signature verification for donations
- Input validation using Zod schemas
- SQL injection protection via parameterized queries
- CORS properly configured

## 📊 Database Functions

- `increment_user_donations` - Safely updates total donation amounts
- `update_updated_at_column` - Auto-updates timestamps
- `update_follower_count` - Maintains follower counts
- `update_like_count` - Maintains like counts
- `handle_new_user` - Creates profile on user signup

## 🔧 Next Steps

1. **Test Authentication:** Sign up at `/auth` to create an account
2. **Submit a Stream:** Use `/submit` to create livestream entries
3. **Integrate Phantom:** Add Phantom wallet adapter for real donations
4. **Add Storage:** Create storage buckets for thumbnails and videos
5. **Deploy:** Use the publish button to deploy your backend

## 📱 Frontend Integration

The frontend is already connected with:
- Auth context managing user sessions
- Protected routes requiring login
- Supabase client configured
- Navigation with sign-out functionality

## 🌐 Backend Dashboard

View your backend data, manage tables, and monitor edge functions:

