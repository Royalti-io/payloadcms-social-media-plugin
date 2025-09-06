# PayloadCMS Social Media Plugin

A comprehensive social media integration plugin for PayloadCMS 3.0+ that enables automated posting and social sharing with encrypted credential management.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PayloadCMS](https://img.shields.io/badge/PayloadCMS-3.0%2B-000000?style=flat)](https://payloadcms.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🔐 **Secure Credential Management** - AES-256-GCM encryption for API keys
- 🐦 **Twitter/X Integration** - Full OAuth 1.0a support with media uploads
- 🚀 **Auto-Posting** - Background queue processing on content publish
- ⚡ **Real-Time Testing** - One-click API credential validation
- 🎨 **Template System** - Customizable message templates with variable substitution
- 🔧 **Non-Breaking** - Seamless integration with existing PayloadCMS projects
- 📱 **Admin Interface** - Intuitive settings management through PayloadCMS admin
- 🛡️ **Production Ready** - Comprehensive error handling and retry logic

## 📦 Installation

### From GitHub (Recommended for now)

```bash
npm install github:nedjamez/payloadcms-social-media-plugin
```

Or with yarn:
```bash
yarn add github:nedjamez/payloadcms-social-media-plugin
```

### Requirements

- PayloadCMS 3.0 or higher
- Node.js 18 or higher
- TypeScript project (recommended)

## 🚀 Quick Start

### 1. Add Plugin to PayloadCMS Config

```typescript
// payload.config.ts
import { buildConfig } from 'payload'
import { socialMediaPlugin } from 'payloadcms-social-media-plugin'

export default buildConfig({
  collections: [
    // Your existing collections
  ],
  plugins: [
    socialMediaPlugin({
      platforms: {
        twitter: {
          enabled: true,
          // Credentials will be managed through admin interface
        }
      },
      collections: {
        posts: {
          name: 'socialSharing',
          platforms: ['twitter'],
          autoPost: false, // Start with manual posting
          templates: [{
            name: 'blog-post',
            template: '📚 New blog post: {{title}}\n\n{{url}} #blog'
          }]
        }
      }
    })
  ]
})
```

### 2. Configure Social Media Credentials

1. Start your PayloadCMS application
2. Login to the admin panel
3. Navigate to **Globals → Social Media Settings**
4. Enable Twitter integration
5. Enter your Twitter API credentials:
   - API Key
   - API Secret  
   - Access Token
   - Access Token Secret
6. Click **Test Connection** to verify your credentials
7. Configure message templates and auto-posting settings

### 3. Start Using Social Sharing

1. Create or edit posts in your enabled collections
2. You'll see a new **Social Sharing** section in the admin interface
3. Enable sharing for specific posts
4. Customize messages or use templates
5. Publish your content → automatic social media posting (if enabled)

## ⚙️ Configuration

### Basic Configuration

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
      shareButtons: {
        enabled: true,
        position: 'bottom'
      }
    }
  }
})
```

### Advanced Configuration

```typescript
socialMediaPlugin({
  platforms: {
    twitter: {
      enabled: true,
      characterLimit: 280,
      allowMedia: true,
      maxMediaSize: 5 * 1024 * 1024 // 5MB
    },
    linkedin: {
      enabled: true,
      characterLimit: 3000,
      postAsOrganization: false
    }
  },
  collections: {
    posts: {
      name: 'socialSharing',
      label: 'Social Media Sharing',
      platforms: ['twitter', 'linkedin'],
      defaultEnabled: false,
      autoPost: true,
      templates: [
        {
          name: 'announcement',
          template: '🎉 {{title}}\n\n{{excerpt}}\n\n{{url}} {{hashtags}}',
          platforms: ['twitter']
        },
        {
          name: 'professional',
          template: 'New article: {{title}}\n\n{{excerpt}}\n\nRead more: {{url}}',
          platforms: ['linkedin']
        }
      ],
      shareButtons: {
        enabled: true,
        position: 'both',
        style: 'buttons'
      }
    }
  },
  options: {
    debug: true,
    analytics: {
      enabled: true
    },
    queue: {
      maxRetries: 3,
      retryDelayMs: 5000
    }
  }
})
```

## 🐦 Twitter API Setup

To use Twitter integration, you need to create a Twitter Developer account and app:

### 1. Create Twitter Developer Account
1. Go to [Twitter Developer Portal](https://developer.twitter.com/)
2. Apply for a developer account
3. Create a new app in your developer dashboard

### 2. Generate API Credentials
1. In your Twitter app dashboard, go to **Keys and tokens**
2. Generate/copy the following credentials:
   - **API Key** (Consumer Key)
   - **API Secret** (Consumer Secret)
   - **Access Token**
   - **Access Token Secret**

### 3. Set App Permissions
1. Go to **App settings → Permissions**
2. Select **Read and Write** permissions
3. Save changes

### 4. Add Credentials to PayloadCMS
1. In your PayloadCMS admin, go to **Globals → Social Media Settings**
2. Enable Twitter integration
3. Enter all four credentials
4. Click **Test Connection** to verify

## 📝 Template Variables

Use these variables in your message templates:

- `{{title}}` - Document title
- `{{excerpt}}` - Document excerpt or truncated content
- `{{url}}` - Full URL to the published content
- `{{slug}}` - Document slug
- `{{hashtags}}` - Auto-generated hashtags from tags/categories
- `{{tags}}` - Document tags (comma-separated)
- `{{author}}` - Author name
- `{{publishDate}}` - Publication date
- `{{customField}}` - Any custom field from your document

### Template Examples

```typescript
templates: [
  {
    name: 'blog-announcement',
    template: '📝 New blog post: {{title}}\n\n{{excerpt}}\n\n🔗 {{url}} {{hashtags}}',
    platforms: ['twitter']
  },
  {
    name: 'news-update',
    template: '🔥 Breaking: {{title}}\n\n{{url}}',
    platforms: ['twitter']
  },
  {
    name: 'linkedin-professional',
    template: 'I\'ve published a new article: {{title}}\n\n{{excerpt}}\n\nRead the full article here: {{url}}\n\n#{{tags}}',
    platforms: ['linkedin']
  }
]
```

## 🔧 Collection Setup

The plugin automatically adds social sharing fields to your specified collections:

```typescript
// Your collection will automatically get these fields added:
{
  name: 'socialSharing',
  type: 'group',
  fields: [
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: false
    },
    {
      name: 'platforms',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Twitter', value: 'twitter' },
        { label: 'LinkedIn', value: 'linkedin' }
      ]
    },
    {
      name: 'customMessage',
      type: 'textarea',
      admin: {
        description: 'Override the default template for this post'
      }
    },
    {
      name: 'autoPost',
      type: 'checkbox',
      defaultValue: true
    }
    // ... additional fields for status tracking
  ]
}
```

## 🛡️ Security Features

- **AES-256-GCM Encryption** - All API credentials encrypted at rest
- **Admin-Only Access** - Social media settings restricted to admin users
- **OAuth 1.0a Security** - Proper Twitter API signature generation
- **Input Validation** - Comprehensive validation and sanitization
- **Error Sanitization** - No sensitive data exposed in error messages

## 📊 Admin Interface Features

- **Real-Time Connection Testing** - Validate API credentials instantly
- **Template Management** - Visual template editor with variable preview
- **Post Status Tracking** - Monitor posting success/failures
- **Bulk Operations** - Enable/disable sharing for multiple posts
- **Error Reporting** - Detailed error messages with troubleshooting guidance

## 🔄 Auto-Posting Behavior

The plugin automatically posts to social media when:

1. **New Content Published** - Content created with status 'published'
2. **Draft to Published** - Existing draft content published
3. **Auto-Post Enabled** - Both global and per-post auto-posting enabled
4. **Platforms Selected** - At least one platform enabled for the post

## 🧪 Testing

Run the included tests:

```bash
npm test
```

Build the plugin:

```bash
npm run build
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Full documentation available in the `/docs` folder
- **Issues**: Report bugs on [GitHub Issues](https://github.com/nedjamez/payloadcms-social-media-plugin/issues)
- **Discord**: Join the PayloadCMS community for support

## 🚗 Roadmap

- [ ] LinkedIn API completion
- [ ] Facebook/Instagram integration
- [ ] Scheduled posting
- [ ] Analytics dashboard
- [ ] Share button components
- [ ] Advanced template editor
- [ ] Webhook integration
- [ ] Multiple account support per platform

## 🙏 Acknowledgments

- PayloadCMS team for the amazing CMS framework
- Twitter/X API documentation and community
- All contributors and testers

---

**Made with ❤️ for the PayloadCMS community**