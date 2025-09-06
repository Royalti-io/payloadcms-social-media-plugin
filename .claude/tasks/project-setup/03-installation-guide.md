# PayloadCMS Social Media Plugin - Installation Guide

## Installation Methods

### Method 1: npm Installation (Recommended)
```bash
# Install the plugin
npm install @payloadcms/plugin-social-media

# Or with yarn
yarn add @payloadcms/plugin-social-media

# Or with pnpm
pnpm add @payloadcms/plugin-social-media
```

### Method 2: GitHub Installation (Development/Beta)
```bash
# Install from GitHub repository
npm install github:payloadcms/plugin-social-media

# Or install specific branch/tag
npm install github:payloadcms/plugin-social-media#main
```

## Basic Configuration

### Step 1: Add Plugin to PayloadCMS Config
```typescript
// payload.config.ts
import { buildConfig } from 'payload'
import { socialMediaPlugin } from '@payloadcms/plugin-social-media'

export default buildConfig({
  collections: [
    // Your existing collections
  ],
  plugins: [
    socialMediaPlugin({
      enabled: true,
      // Basic configuration options
      collections: ['posts', 'pages'], // Collections to enable sharing for
      platforms: ['twitter', 'facebook', 'linkedin'], // Platforms to support
    }),
  ],
  // Rest of your config...
})
```

### Step 2: Environment Variables (Optional)
While the plugin primarily uses admin-managed settings, you can optionally set these environment variables:
```bash
# .env.local
PAYLOAD_SECRET=your-existing-payload-secret # Used for encryption

# Optional: Default encryption key (if different from PAYLOAD_SECRET)
SOCIAL_MEDIA_ENCRYPTION_KEY=your-custom-encryption-key

# Optional: Development mode settings
NODE_ENV=development
```

### Step 3: Database Migration
The plugin automatically creates the necessary database schema. After adding the plugin, restart your PayloadCMS application:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

### Step 4: Access Admin Settings
1. Start your PayloadCMS application
2. Login to the admin panel
3. Navigate to **Globals → Social Media Settings**
4. Configure your social media platform credentials

## Advanced Configuration Options

### Complete Plugin Configuration
```typescript
// payload.config.ts
import { socialMediaPlugin } from '@payloadcms/plugin-social-media'

export default buildConfig({
  plugins: [
    socialMediaPlugin({
      // Basic Settings
      enabled: true,
      collections: ['posts', 'pages', 'articles'], // Collections to enable
      
      // Platform Configuration
      platforms: {
        twitter: {
          enabled: true,
          autoPost: true, // Auto-post new content
        },
        facebook: {
          enabled: true,
          autoPost: false, // Manual posting only
        },
        linkedin: {
          enabled: true,
          autoPost: true,
        },
        instagram: {
          enabled: false, // Disabled by default
          autoPost: false,
        },
      },
      
      // Share Buttons Configuration
      shareButtons: {
        enabled: true,
        style: 'buttons', // 'icons' | 'buttons' | 'minimal'
        position: 'bottom', // 'top' | 'bottom' | 'both'
        platforms: ['twitter', 'facebook', 'linkedin'],
        customStyles: {
          // Custom CSS styles (optional)
        },
      },
      
      // Message Templates
      messageTemplates: {
        default: '{{title}} - {{excerpt}}\n\n{{url}}',
        twitter: '{{title}} {{hashtags}}\n\n{{url}}',
        facebook: '{{title}}\n\n{{excerpt}}\n\n{{url}}',
        linkedin: '{{title}}\n\n{{excerpt}}\n\n{{url}} #{{tags}}',
      },
      
      // Advanced Options
      options: {
        encryptionKey: process.env.SOCIAL_MEDIA_ENCRYPTION_KEY, // Optional custom key
        queueProcessing: true, // Enable background queue processing
        retryAttempts: 3, // Number of retry attempts for failed posts
        analytics: {
          enabled: true,
          provider: 'google', // 'google' | 'custom' | false
        },
      },
      
      // Custom Endpoints
      endpoints: {
        testConnection: '/api/social-media/test', // Custom test endpoint
        webhook: '/api/social-media/webhook', // Webhook endpoint for external services
      },
      
      // Access Control
      access: {
        settings: ({ req: { user } }) => user?.role === 'admin',
        sharing: ({ req: { user } }) => Boolean(user), // Any authenticated user
      },
    }),
  ],
})
```

### Collection-Specific Configuration
You can also configure sharing settings per collection:

```typescript
// collections/Posts.ts
import { CollectionConfig } from 'payload'

export const Posts: CollectionConfig = {
  slug: 'posts',
  fields: [
    // Your existing fields...
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
    },
    // Social media plugin will automatically add sharing fields
  ],
  // Plugin-specific collection settings
  socialMedia: {
    enabled: true,
    autoPost: true,
    shareButtons: {
      enabled: true,
      position: 'both',
    },
    messageTemplate: 'New post: {{title}}\n\n{{excerpt}}\n\n{{url}}',
    platforms: ['twitter', 'facebook', 'linkedin'],
  },
}
```

## Frontend Integration

### Next.js App Router Integration
```typescript
// app/posts/[slug]/page.tsx
import { getPayloadHMR } from '@payloadcms/next/utilities'
import { ShareButtons } from '@payloadcms/plugin-social-media/client'
import configPromise from '@payload-config'

export default async function PostPage({ params }: { params: { slug: string } }) {
  const payload = await getPayloadHMR({ config: configPromise })
  
  const posts = await payload.find({
    collection: 'posts',
    where: {
      slug: {
        equals: params.slug,
      },
    },
  })
  
  const post = posts.docs[0]
  
  if (!post) {
    notFound()
  }
  
  return (
    <article>
      <h1>{post.title}</h1>
      
      {/* Share buttons at top */}
      <ShareButtons
        post={post}
        position="top"
        style="icons"
        platforms={['twitter', 'facebook', 'linkedin']}
      />
      
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
      
      {/* Share buttons at bottom */}
      <ShareButtons
        post={post}
        position="bottom"
        style="buttons"
      />
    </article>
  )
}
```

### React Component Usage
```typescript
// components/PostCard.tsx
import { ShareButtons } from '@payloadcms/plugin-social-media/client'

export function PostCard({ post }: { post: any }) {
  return (
    <div className="post-card">
      <h2>{post.title}</h2>
      <p>{post.excerpt}</p>
      
      <ShareButtons
        post={post}
        style="minimal"
        platforms={['twitter', 'facebook']}
        customStyles={{
          container: 'flex gap-2 mt-4',
          button: 'px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600',
        }}
      />
    </div>
  )
}
```

### Manual Share Button Implementation
```typescript
// For custom implementations
import { generateShareUrls } from '@payloadcms/plugin-social-media/utils'

export function CustomShareButtons({ post }: { post: any }) {
  const shareUrls = generateShareUrls({
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/posts/${post.slug}`,
    title: post.title,
    description: post.excerpt,
    hashtags: post.tags?.join(','),
  })
  
  return (
    <div className="share-buttons">
      <a href={shareUrls.twitter} target="_blank" rel="noopener noreferrer">
        Share on Twitter
      </a>
      <a href={shareUrls.facebook} target="_blank" rel="noopener noreferrer">
        Share on Facebook
      </a>
      <a href={shareUrls.linkedin} target="_blank" rel="noopener noreferrer">
        Share on LinkedIn
      </a>
    </div>
  )
}
```

## Configuration Validation

### Plugin Options Validation
The plugin includes built-in validation for configuration options:

```typescript
// This will throw helpful errors if configuration is invalid
socialMediaPlugin({
  collections: ['nonexistent-collection'], // ❌ Error: Collection doesn't exist
  platforms: ['invalid-platform'], // ❌ Error: Unsupported platform
  shareButtons: {
    style: 'invalid-style', // ❌ Error: Invalid style option
  },
})
```

### Runtime Validation
The plugin validates settings at runtime and provides helpful error messages:

- Missing API credentials
- Invalid platform configurations  
- Malformed message templates
- Collection permission errors

## Database Schema

### Automatic Schema Creation
The plugin automatically creates the following database structures:

```typescript
// Social Media Settings Global
{
  slug: 'social-media-settings',
  fields: {
    // Platform configurations
    twitterEnabled: boolean,
    twitterApiKey: string, // encrypted
    twitterApiSecret: string, // encrypted
    // ... other platform settings
    
    // General settings
    defaultAutoPost: boolean,
    messageTemplate: string,
    shareButtonsEnabled: boolean,
    // ... other global settings
  }
}

// Added to each enabled collection
{
  // Existing collection fields...
  
  // Added by plugin
  socialSharing: {
    enabled: boolean,
    autoPost: boolean,
    customMessage: string,
    platforms: string[],
    shareButtons: {
      enabled: boolean,
      position: 'top' | 'bottom' | 'both',
    },
    postingStatus: {
      twitter: 'pending' | 'success' | 'failed',
      facebook: 'pending' | 'success' | 'failed',
      // ... other platforms
    },
    lastPosted: Date,
    postUrls: {
      twitter: string,
      facebook: string,
      // ... platform-specific URLs
    }
  }
}
```

## Troubleshooting Common Issues

### Issue 1: Plugin Not Loading
**Symptoms**: Plugin settings don't appear in admin
**Solutions**:
```bash
# Check plugin is properly installed
npm list @payloadcms/plugin-social-media

# Restart development server
npm run dev

# Check payload.config.ts syntax
npx tsc --noEmit payload.config.ts
```

### Issue 2: API Key Encryption Errors
**Symptoms**: Cannot save API keys in admin
**Solutions**:
```bash
# Ensure PAYLOAD_SECRET is set
echo $PAYLOAD_SECRET

# Check encryption key configuration
# If using custom encryption key, ensure it's set correctly
```

### Issue 3: Auto-Posting Not Working
**Symptoms**: Content published but not shared to social media
**Solutions**:
1. Check platform is enabled in settings
2. Verify API credentials with connection test
3. Check collection is included in plugin configuration
4. Review error logs in admin panel

### Issue 4: Share Buttons Not Displaying
**Symptoms**: Share buttons missing from frontend
**Solutions**:
1. Verify ShareButtons component is imported correctly
2. Check collection has social sharing enabled
3. Ensure proper CSS is loaded
4. Verify post data includes necessary fields

## Support and Community

### Getting Help
- **Documentation**: https://payloadcms.com/docs/plugins/social-media
- **GitHub Issues**: https://github.com/payloadcms/plugin-social-media/issues
- **Discord Community**: https://discord.gg/payload
- **Stack Overflow**: Tag questions with `payloadcms` and `social-media`

### Contributing
- **Bug Reports**: Use GitHub issues with detailed reproduction steps
- **Feature Requests**: Start a GitHub discussion to gather community feedback
- **Pull Requests**: Follow the contributing guidelines in the repository

### Release Updates
- **npm Updates**: Use `npm update @payloadcms/plugin-social-media`
- **Breaking Changes**: Check CHANGELOG.md for migration guides
- **Security Updates**: Enable GitHub security alerts for the repository
