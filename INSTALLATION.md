# Installation Guide for PayloadCMS Social Media Plugin

## 🚀 Installing from GitHub in Your PayloadCMS Project

This guide will help you install and configure the PayloadCMS Social Media Plugin from GitHub in your existing PayloadCMS application.

## Prerequisites

- PayloadCMS 3.0 or higher
- Node.js 18 or higher
- An existing PayloadCMS project
- Twitter Developer Account (for Twitter integration)

## Installation Steps

### 1. Install the Plugin

In your PayloadCMS project directory, run:

```bash
npm install github:nedjamez/payloadcms-social-media-plugin
```

Or with yarn:
```bash
yarn add github:nedjamez/payloadcms-social-media-plugin
```

### 2. Add Plugin to Your PayloadCMS Config

Update your `payload.config.ts` file:

```typescript
// payload.config.ts
import { buildConfig } from 'payload'
import { socialMediaPlugin } from 'payloadcms-social-media-plugin'

export default buildConfig({
  // Your existing configuration
  collections: [
    // Your existing collections
  ],
  plugins: [
    // Your existing plugins
    socialMediaPlugin({
      platforms: {
        twitter: {
          enabled: true,
          characterLimit: 280,
          allowMedia: true
        }
      },
      collections: {
        posts: { // Replace 'posts' with your collection slug
          name: 'socialSharing',
          platforms: ['twitter'],
          autoPost: false, // Start with manual posting for safety
          templates: [{
            name: 'blog-post',
            template: '📚 New blog post: {{title}}\n\n{{url}} #blog'
          }]
        }
      },
      options: {
        debug: true // Enable debug logging during setup
      }
    })
  ]
})
```

### 3. Restart Your Development Server

```bash
npm run dev
# or
yarn dev
```

### 4. Verify Installation

1. Open your PayloadCMS admin panel
2. You should see a new "Social Media Settings" option under **Globals**
3. Navigate to it to configure your social media credentials

## Setting Up Twitter Integration

### 1. Create Twitter Developer Account

1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Apply for a developer account (this may take a few days)
3. Once approved, create a new app

### 2. Generate API Credentials

In your Twitter app dashboard:

1. Go to **Keys and tokens** tab
2. Generate and copy these credentials:
   - **API Key** (also called Consumer Key)
   - **API Secret** (also called Consumer Secret)
   - **Access Token**
   - **Access Token Secret**

### 3. Set App Permissions

1. Go to **App settings → Permissions**
2. Select **Read and Write** permissions
3. Save changes

### 4. Configure in PayloadCMS

1. In PayloadCMS admin, go to **Globals → Social Media Settings**
2. Enable Twitter integration
3. Enter your four Twitter credentials
4. Click **Test Connection** to verify they work
5. Save your settings

## Testing Your Setup

### 1. Create a Test Post

1. Go to your posts collection (or whichever collection you configured)
2. Create a new post
3. In the **Social Sharing** section:
   - Enable social sharing
   - Select Twitter as a platform
   - Customize the message if desired
4. Publish the post

### 2. Verify Auto-Posting (if enabled)

If you enabled auto-posting, the plugin should automatically post to Twitter when you publish content.

### 3. Check Logs

Look at your server logs for any error messages or confirmation of successful posts.

## Configuration Examples

### Basic Blog Setup

```typescript
socialMediaPlugin({
  platforms: {
    twitter: {
      enabled: true,
      characterLimit: 280,
      allowMedia: true
    }
  },
  collections: {
    posts: {
      name: 'socialSharing',
      platforms: ['twitter'],
      autoPost: true,
      templates: [{
        name: 'blog-announcement',
        template: '📝 {{title}}\n\n{{excerpt}}\n\n{{url}} #blog'
      }]
    }
  }
})
```

### News Site Setup

```typescript
socialMediaPlugin({
  platforms: {
    twitter: {
      enabled: true,
      characterLimit: 280
    }
  },
  collections: {
    articles: {
      name: 'socialSharing',
      platforms: ['twitter'],
      autoPost: true,
      templates: [
        {
          name: 'breaking-news',
          template: '🔥 BREAKING: {{title}}\n\n{{url}}'
        },
        {
          name: 'regular-news',
          template: '📰 {{title}}\n\n{{excerpt}}\n\n{{url}} #news'
        }
      ]
    }
  }
})
```

### E-commerce Setup

```typescript
socialMediaPlugin({
  platforms: {
    twitter: {
      enabled: true,
      characterLimit: 280,
      allowMedia: true
    }
  },
  collections: {
    products: {
      name: 'socialSharing',
      platforms: ['twitter'],
      autoPost: false, // Manual approval for product posts
      templates: [{
        name: 'product-launch',
        template: '🛍️ New Product: {{title}}\n\n{{excerpt}}\n\nShop now: {{url}} #newproduct'
      }]
    }
  }
})
```

## Troubleshooting

### Plugin Not Loading

1. **Check your import**: Make sure you're importing from `'payloadcms-social-media-plugin'`
2. **Restart server**: Always restart your dev server after adding plugins
3. **Check logs**: Look for error messages in your terminal

### Twitter Connection Fails

1. **Verify credentials**: Double-check all four Twitter API credentials
2. **Check app permissions**: Ensure your Twitter app has "Read and Write" permissions
3. **Test in admin**: Use the "Test Connection" button in Social Media Settings

### Auto-posting Not Working

1. **Check collection configuration**: Ensure your collection slug matches the plugin config
2. **Verify global settings**: Make sure Twitter is enabled in Social Media Settings
3. **Check per-post settings**: Ensure social sharing is enabled on individual posts
4. **Review logs**: Look for error messages in your server logs

### Build Errors

If you get TypeScript errors:

1. **Update TypeScript**: Ensure you're using TypeScript 5.0+
2. **Check PayloadCMS version**: Plugin requires PayloadCMS 3.0+
3. **Clear node_modules**: Delete node_modules and package-lock.json, then reinstall

## Need Help?

- **Plugin Issues**: [GitHub Issues](https://github.com/nedjamez/payloadcms-social-media-plugin/issues)
- **PayloadCMS Community**: [Discord](https://discord.gg/payload)
- **Documentation**: Check the README.md file for detailed configuration options

## Next Steps

Once you have the plugin working:

1. **Customize templates** to match your brand voice
2. **Enable auto-posting** after testing manually
3. **Add more collections** if needed
4. **Set up LinkedIn** (when the integration is completed)
5. **Monitor posting logs** to ensure everything works smoothly

The plugin is designed to be safe by default - it won't automatically post anything unless you explicitly enable it, so you can test thoroughly before going live!