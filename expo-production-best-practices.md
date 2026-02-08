# Expo Production Best Practices

This skill file outlines the mandatory best practices for configuring and deploying Expo applications to production environments. **ALL AGENTS MUST FOLLOW THESE GUIDELINES.**

## 1. Environment Variables: The `EXPO_PUBLIC_` Rule

**CRITICAL RULE:** Any environment variable that needs to be accessed by the running application on the user's device **MUST** be prefixed with `EXPO_PUBLIC_`.

-   **Why?** Expo's build system (Metro) effectively "inlines" these variables into the JavaScript bundle at build time. Variables without this prefix are strictly server-side/build-time only and will be `undefined` in the app.
-   **Example:**
    -   ❌ `API_KEY=123` -> `process.env.API_KEY` is `undefined` in the app.
    -   ✅ `EXPO_PUBLIC_API_KEY=123` -> `process.env.EXPO_PUBLIC_API_KEY` is `'123'`.

### Security Warning
**NEVER** use `EXPO_PUBLIC_` for sensitive secrets such as:
-   Service Account Keys (Google/Firebase Admin SDK)
-   Database Admin Passwords
-   Stripe Secret Keys

These should only be used in backend functions or strictly for build-time configuration scripts, never bundled in the app.

---

## 2. `eas.json` Configuration

You must configure `eas.json` to handle distinct profiles for Development, Preview (Internal Distribution), and Production (App Store).

### Recommended `eas.json` Structure

```json
{
  "cli": {
    "version": ">= 7.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "resourceClass": "m-medium"
      },
      "env": {
        "EXPO_PUBLIC_APP_VARIANT": "development"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "resourceClass": "m-medium"
      },
      "env": {
        "EXPO_PUBLIC_APP_VARIANT": "preview"
      }
    },
    "production": {
      "distribution": "store",
      "autoSubmit": true,
      "ios": {
        "resourceClass": "m-medium"
      },
      "env": {
        "EXPO_PUBLIC_APP_VARIANT": "production"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "your-app-store-connect-id",
        "appleTeamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

**Key Points:**
-   **`development`**: Builds a "Development Client" (custom generic app) to run your project.
-   **`preview`**: Builds a standalone app for internal distribution (e.g., TestFlight or direct install). Good for QA.
-   **`production`**: The optimized build for the App Store.

---

## 3. Google Cloud Console: iOS Bundle ID Whitelisting

When using Google Maps, Firebase, or Gemini APIs, you must restrict your API keys to prevent unauthorized use.

### Checklist for Whitelisting

1.  **Navigate to Google Cloud Console:**
    -   Go to [APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials).
2.  **Select Your Key:**
    -   Click on the API Key being used in your Expo app (e.g., `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`).
3.  **Set Application Restrictions:**
    -   Under "Key restrictions", select **iOS apps**.
4.  **Add Bundle Identifier:**
    -   Click **ADD AN ITEM**.
    -   Enter your Bundle ID from `app.json`.
    -   **Target Bundle ID:** `com.harpelleapps.volleytrack`
5.  **Save Changes.**

### Troubleshooting
-   **"Requests from this iOS client application <empty> are blocked."**
    -   This error means the restriction is active but the app's bundle ID is not being sent or matched correctly. Ensure your `app.json` `ios.bundleIdentifier` matches EXACTLY what is in the Cloud Console.
-   **Development Builds:**
    -   If using Expo Go, you cannot restrict by Bundle ID effectively because Expo Go's bundle ID is `host.exp.exponent`.
    -   **Solution:** Use a **Development Build** (runtime custom client) which uses your own Bundle ID (`com.harpelleapps.volleytrack`).
