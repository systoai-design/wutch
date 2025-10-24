# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/3561f8c1-735e-43eb-9412-fe29af22feae

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/3561f8c1-735e-43eb-9412-fe29af22feae) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/3561f8c1-735e-43eb-9412-fe29af22feae) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Building Android APK

### Prerequisites
- Android Studio installed
- Project synced with Capacitor: `npm run android:sync`

### Quick Debug APK (for testing)
```bash
# macOS/Linux
npm run android:build:debug

# Windows
npm run android:build:debug:win
```
Output: `android/app/build/outputs/apk/debug/app-debug.apk`

**Note:** Debug APKs may trigger antivirus warnings. Use signed release APKs for distribution.

### Creating a Signed Release APK (recommended for distribution)

#### Step 1: Generate a Keystore (one-time setup)
```bash
keytool -genkey -v -keystore wutch-release-key.keystore -alias wutch -keyalg RSA -keysize 2048 -validity 10000
```

You'll be prompted for:
- **Keystore password** (remember this!)
- Your name, organization, city, country
- **Key password** (remember this too!)

**⚠️ CRITICAL:** Keep this `.keystore` file safe and backed up! You'll need it for all future app updates. If you lose it, you cannot update your app on Google Play Store.

#### Step 2: Build and Sign the Release APK

**Option A: Using Android Studio (Recommended)**
1. Open Android Studio:
   ```bash
   npm run android:open
   ```

2. Go to: **Build → Generate Signed Bundle / APK**

3. Select **APK** and click **Next**

4. Click **Choose existing...** and select your `.keystore` file

5. Enter:
   - Keystore password
   - Key alias: `wutch`
   - Key password

6. Select **release** build variant

7. Click **Finish**

8. Find your signed APK at:
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

**Option B: Using Command Line**
1. Build the release APK:
   ```bash
   # macOS/Linux
   npm run android:build:release
   
   # Windows
   npm run android:build:release:win
   ```

2. Sign it manually using `jarsigner` (requires additional configuration)

#### Step 3: Distribute Your APK
Your signed `app-release.apk` will:
- ✅ Not trigger virus/security warnings
- ✅ Work offline (bundled assets, no hosted URL)
- ✅ Launch directly to `/app` (no landing page)
- ✅ Be ready for distribution or Google Play Store submission

### Building for Google Play Store (AAB format)
```bash
cd android
./gradlew bundleRelease
```
Output: `android/app/build/outputs/bundle/release/app-release.aab`

Sign the AAB using the same keystore through Android Studio's **Generate Signed Bundle** option.
