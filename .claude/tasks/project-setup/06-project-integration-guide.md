# PayloadCMS Social Media Plugin - Project Integration Guide

## Integration with Existing PayloadCMS Projects

This guide specifically addresses how the social media plugin integrates with existing PayloadCMS projects like Royalti.io, covering installation, data preservation, and seamless integration procedures.

## Understanding the Target Project Structure

### Royalti.io Project Analysis
Based on the existing Royalti.io project structure:

```
src/
├── collections/
│   ├── Posts/           # Blog posts with rich content
│   ├── Pages/           # Static pages
│   ├── Categories.ts    # Post categorization
│   ├── Tags.ts         # Post tagging
│   └── Media.ts        # Media management
├── plugins/
│   └── index.ts        # Existing plugins (SEO, form builder, etc.)
└── payload.config.ts   # Main configuration
```

### Integration Points
1. **Posts Collection**: Primary target for social sharing
2. **Pages Collection**: Secondary target for sharing
3. **Plugin System**: Already established plugin architecture
4. **Media Collection**: Integration for social media images

## Installation Workflow for Existing Projects

### Phase 1: Pre-Installation Assessment
```typescript
// src/utils/preInstallationCheck.ts
export interface ProjectAssessment {
  payloadVersion: string
  collections: CollectionInfo[]
  existingPlugins: string[]
  databaseAdapter: string
  compatibilityIssues: string[]
  recommendations: string[]
}

export const assessProject = async (config: Config): Promise<ProjectAssessment> => {
  const assessment: ProjectAssessment = {
    payloadVersion: getPayloadVersion(),
    collections: analyzeCollections(config.collections),
    existingPlugins: getPluginList(config.plugins),
    databaseAdapter: getDatabaseAdapter(config.db),
    compatibilityIssues: [],
    recommendations: []
  }
  
  // Check for compatibility issues
  if (versionLessThan(assessment.payloadVersion, '3.0.0')) {
    assessment.compatibilityIssues.push('PayloadCMS 3.0+ required')
  }
  
  // Analyze collections for social sharing potential
  const textCollections = assessment.collections.filter(col => 
    col.hasTextField && col.hasRichTextField
  )
  
  if (textCollections.length > 0) {
    assessment.recommendations.push(
      `Recommended collections for social sharing: ${textCollections.map(c => c.slug).join(', ')}`
    )
  }
  
  return assessment
}
```

### Phase 2: Safe Installation Process
```bash
#!/bin/bash
# install-social-media-plugin.sh

echo "🔍 Assessing PayloadCMS project compatibility..."

# 1. Check PayloadCMS version
PAYLOAD_VERSION=$(npm list @payloadcms/next --depth=0 2>/dev/null | grep @payloadcms/next | sed 's/.*@//')
echo "Current PayloadCMS version: $PAYLOAD_VERSION"

# 2. Create backup of current configuration
echo "💾 Creating configuration backup..."
cp src/payload.config.ts src/payload.config.ts.backup
cp package.json package.json.backup

# 3. Install the plugin
echo "📦 Installing social media plugin..."
npm install @payloadcms/plugin-social-media

# 4. Generate integration suggestion
echo "🔧 Analyzing project structure for optimal integration..."
node -e "
const config = require('./src/payload.config.ts');
const { assessProject } = require('@payloadcms/plugin-social-media/utils');
assessProject(config).then(assessment => {
  console.log('📊 Project Assessment:');
  console.log(JSON.stringify(assessment, null, 2));
});
"

echo "✅ Installation complete! Next steps:"
echo "1. Review the project assessment above"
echo "2. Add plugin configuration to payload.config.ts"
echo "3. Restart your development server"
echo "4. Configure social media credentials in admin panel"
```

### Phase 3: Configuration Integration
```typescript
// Example integration with Royalti.io structure
import { socialMediaPlugin } from '@payloadcms/plugin-social-media'

export default buildConfig({
  // ... existing configuration
  plugins: [
    // Existing plugins
    ...plugins, // From src/plugins/index.ts
    
    // Social media plugin with project-specific settings
    socialMediaPlugin({
      enabled: true,
      
      // Target the existing collections
      collections: ['posts', 'pages'],
      
      // Configure for blog-focused sharing
      platforms: {
        twitter: {
          enabled: true,
          autoPost: false, // Conservative default
        },
        facebook: {
          enabled: true, 
          autoPost: false,
        },
        linkedin: {
          enabled: true,
          autoPost: false,
        },
      },
      
      // Share buttons configuration
      shareButtons: {
        enabled: true,
        style: 'buttons',
        position: 'bottom',
        platforms: ['twitter', 'facebook', 'linkedin'],
      },
      
      // Message templates optimized for blog content
      messageTemplates: {
        default: '{{title}}\n\n{{excerpt}}\n\n{{url}} #royalti',
        twitter: '{{title}} {{hashtags}}\n\n{{url}}',
        linkedin: 'New post: {{title}}\n\n{{excerpt}}\n\nRead more: {{url}}',
      },
      
      // Access control aligned with existing user roles
      access: {
        settings: ({ req: { user } }) => user?.role === 'admin',
        sharing: ({ req: { user } }) => Boolean(user),
      },
      
      // Integration with existing analytics
      options: {
        analytics: {
          enabled: true,
          provider: 'custom', // Integrate with existing analytics
        },
      },
    }),
  ],
})
```

## Data Migration and Preservation

### Safe Migration Strategy
```typescript
// src/migrations/001-add-social-media-plugin.ts
export const addSocialMediaPlugin = {
  version: '1.0.0',
  description: 'Add social media plugin to existing project',
  
  up: async ({ payload, req }) => {
    console.log('🔄 Adding social media plugin to existing project...')
    
    try {
      // 1. Create backup of all existing posts
      const existingPosts = await payload.find({
        collection: 'posts',
        limit: 10000,
        req,
      })
      
      await payload.create({
        collection: 'backups',
        data: {
          type: 'pre-social-media-migration',
          data: JSON.stringify(existingPosts.docs),
          createdAt: new Date(),
        },
        req,
      })
      
      // 2. Initialize social media settings with safe defaults
      const defaultSettings = {
        defaultAutoPost: false, // Conservative default
        messageTemplate: '{{title}}\n\n{{url}}',
        shareButtons: {
          enabled: true,
          style: 'buttons',
          position: 'bottom',
        },
        
        // All platforms disabled by default
        twitterEnabled: false,
        facebookEnabled: false,
        linkedinEnabled: false,
        instagramEnabled: false,
      }
      
      await payload.updateGlobal({
        slug: 'social-media-settings',
        data: defaultSettings,
        req,
      })
      
      // 3. Add social sharing fields to existing posts (disabled by default)
      let processedCount = 0
      const totalPosts = existingPosts.totalDocs
      
      for (const post of existingPosts.docs) {
        await payload.update({
          collection: 'posts',
          id: post.id,
          data: {
            socialSharing: {
              enabled: false, // Conservative default
              autoPost: false,
              platforms: [],
              shareButtons: {
                enabled: true,
                position: 'bottom',
              },
            },
          },
          req,
        })
        
        processedCount++
        if (processedCount % 10 === 0) {
          console.log(`📝 Processed ${processedCount}/${totalPosts} posts`)
        }
      }
      
      console.log('✅ Social media plugin migration completed successfully')
      console.log('📋 Next steps:')
      console.log('1. Configure API credentials in Admin → Social Media Settings')
      console.log('2. Enable sharing for desired posts')
      console.log('3. Test connections before enabling auto-posting')
      
    } catch (error) {
      console.error('❌ Migration failed:', error)
      throw error
    }
  },
  
  down: async ({ payload, req }) => {
    // Rollback procedure
    console.log('🔄 Rolling back social media plugin installation...')
    
    // Remove social sharing fields from all posts
    const posts = await payload.find({
      collection: 'posts',
      limit: 10000,
      req,
    })
    
    for (const post of posts.docs) {
      const { socialSharing, ...postData } = post
      await payload.update({
        collection: 'posts',
        id: post.id,
        data: postData,
        req,
      })
    }
    
    console.log('✅ Rollback completed')
  }
}
```

### Collection Enhancement Without Breaking Changes
```typescript
// src/utils/collectionEnhancer.ts
export const enhanceExistingCollection = (
  collection: CollectionConfig,
  pluginOptions: SocialMediaPluginOptions
): CollectionConfig => {
  
  // Only enhance if collection is in the target list
  if (!pluginOptions.collections?.includes(collection.slug)) {
    return collection
  }
  
  // Preserve existing structure
  const enhancedCollection = {
    ...collection,
    fields: [...collection.fields]
  }
  
  // Add social sharing tab if collection uses tabs
  const hasTabsField = collection.fields.some(field => field.type === 'tabs')
  
  if (hasTabsField) {
    // Find the tabs field and add social media tab
    const tabsFieldIndex = collection.fields.findIndex(field => field.type === 'tabs')
    const tabsField = collection.fields[tabsFieldIndex] as TabsField
    
    enhancedCollection.fields[tabsFieldIndex] = {
      ...tabsField,
      tabs: [
        ...tabsField.tabs,
        {
          label: 'Social Media',
          fields: [
            socialSharingField,
          ]
        }
      ]
    }
  } else {
    // Add social sharing field as regular field
    enhancedCollection.fields.push(socialSharingField)
  }
  
  // Enhance hooks without breaking existing ones
  enhancedCollection.hooks = {
    ...collection.hooks,
    afterChange: [
      ...(collection.hooks?.afterChange || []),
      socialMediaAutoPostHook,
    ],
  }
  
  return enhancedCollection
}
```

## Frontend Integration with Existing Components

### Non-Breaking Share Button Integration
```typescript
// src/components/social-media/PostEnhancer.tsx
export const PostEnhancer: React.FC<{
  post: any
  children: React.ReactNode
  enableShareButtons?: boolean
}> = ({ post, children, enableShareButtons = true }) => {
  // Check if post has social sharing enabled
  const hasSocialSharing = post.socialSharing?.enabled
  const shareButtonsEnabled = post.socialSharing?.shareButtons?.enabled
  
  if (!hasSocialSharing || !shareButtonsEnabled || !enableShareButtons) {
    return <>{children}</>
  }
  
  return (
    <div className="post-with-social-sharing">
      {/* Render share buttons at top if configured */}
      {post.socialSharing.shareButtons.position === 'top' && (
        <ShareButtons post={post} position="top" />
      )}
      
      {/* Original content unchanged */}
      {children}
      
      {/* Render share buttons at bottom if configured */}
      {post.socialSharing.shareButtons.position === 'bottom' && (
        <ShareButtons post={post} position="bottom" />
      )}
    </div>
  )
}

// Usage in existing Royalti.io components
// app/[year]/[month]/[slug]/page.tsx (existing blog post page)
export default async function BlogPost({ params }) {
  const post = await getPost(params)
  
  return (
    <PostEnhancer post={post}>
      {/* Existing blog post rendering logic unchanged */}
      <article>
        <h1>{post.title}</h1>
        <div dangerouslySetInnerHTML={{ __html: post.content }} />
      </article>
    </PostEnhancer>
  )
}
```

### Automatic Integration Detection
```typescript
// src/utils/integrationDetector.ts
export const detectIntegrationPoints = (projectStructure: any) => {
  const integrationPoints: IntegrationPoint[] = []
  
  // Scan for blog post templates
  const blogTemplates = findFiles(projectStructure, /\[.*slug.*\].*\.tsx$/)
  for (const template of blogTemplates) {
    integrationPoints.push({
      type: 'blog-template',
      file: template.path,
      suggestion: 'Add PostEnhancer wrapper to enable share buttons',
      automaticIntegration: true,
    })
  }
  
  // Scan for post listing pages
  const listingPages = findFiles(projectStructure, /posts.*page\.tsx$/)
  for (const page of listingPages) {
    integrationPoints.push({
      type: 'listing-page',
      file: page.path,
      suggestion: 'Add share buttons to post preview cards',
      automaticIntegration: false,
    })
  }
  
  return integrationPoints
}
```

## Update and Maintenance Procedures

### Zero-Downtime Updates
```bash
#!/bin/bash
# update-social-media-plugin.sh

echo "🔄 Updating social media plugin..."

# 1. Create pre-update backup
echo "💾 Creating pre-update backup..."
npm run payload:backup --collection=social-media-settings
npm run payload:backup --collection=posts --fields=socialSharing

# 2. Check for breaking changes
CURRENT_VERSION=$(npm list @payloadcms/plugin-social-media --depth=0 2>/dev/null | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')
LATEST_VERSION=$(npm show @payloadcms/plugin-social-media version)

echo "Current version: $CURRENT_VERSION"
echo "Latest version: $LATEST_VERSION"

# Check if major version change
CURRENT_MAJOR=$(echo $CURRENT_VERSION | cut -d. -f1)
LATEST_MAJOR=$(echo $LATEST_VERSION | cut -d. -f1)

if [ "$CURRENT_MAJOR" != "$LATEST_MAJOR" ]; then
  echo "⚠️ Major version change detected. Please review breaking changes:"
  npm show @payloadcms/plugin-social-media changelog
  read -p "Continue with update? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# 3. Perform update
echo "📦 Updating plugin..."
npm update @payloadcms/plugin-social-media

# 4. Run any necessary migrations
echo "🔄 Running migrations..."
npm run payload:migrate

# 5. Restart application
echo "🔄 Restarting application..."
npm run build
pm2 restart royalti-io # or your process manager

echo "✅ Update completed successfully!"
```

### Health Check After Updates
```typescript
// src/utils/healthCheck.ts
export const performHealthCheck = async (payload: Payload) => {
  const healthReport: HealthReport = {
    pluginVersion: getPluginVersion(),
    settingsIntegrity: await checkSettingsIntegrity(payload),
    collectionIntegrity: await checkCollectionIntegrity(payload),
    apiConnections: await testAllApiConnections(payload),
    migrationStatus: await checkMigrationStatus(payload),
    issues: [],
  }
  
  // Check for common issues
  if (!healthReport.settingsIntegrity.valid) {
    healthReport.issues.push({
      severity: 'error',
      message: 'Social media settings are corrupted',
      solution: 'Restore from backup or reconfigure settings',
    })
  }
  
  if (healthReport.apiConnections.failedConnections.length > 0) {
    healthReport.issues.push({
      severity: 'warning',
      message: `Failed API connections: ${healthReport.apiConnections.failedConnections.join(', ')}`,
      solution: 'Check API credentials in admin panel',
    })
  }
  
  return healthReport
}
```

## Seed Data for Different Environments

### Production Seed Data (Safe Defaults)
```typescript
// src/seeds/production.ts
export const productionSeedData = {
  'social-media-settings': {
    // Conservative defaults for production
    defaultAutoPost: false,
    messageTemplate: '{{title}}\n\n{{url}}',
    shareButtons: {
      enabled: true,
      style: 'buttons',
      position: 'bottom',
    },
    includeHashtags: true,
    
    // All platforms disabled initially (admin must enable and configure)
    twitterEnabled: false,
    facebookEnabled: false,
    linkedinEnabled: false,
    instagramEnabled: false,
  }
}

export const seedProductionData = async (payload: Payload) => {
  console.log('🌱 Seeding production social media data...')
  
  try {
    await payload.updateGlobal({
      slug: 'social-media-settings',
      data: productionSeedData['social-media-settings'],
    })
    
    console.log('✅ Production data seeded successfully')
  } catch (error) {
    console.error('❌ Failed to seed production data:', error)
  }
}
```

### Development/Staging Seed Data
```typescript
// src/seeds/development.ts
export const developmentSeedData = {
  'social-media-settings': {
    // More permissive defaults for development
    defaultAutoPost: false, // Still conservative to prevent accidental posts
    messageTemplate: '[DEV] {{title}}\n\n{{excerpt}}\n\n{{url}}',
    shareButtons: {
      enabled: true,
      style: 'buttons',
      position: 'both', // Test both positions
    },
    
    // Enable platforms but with test credentials
    twitterEnabled: true,
    twitterApiKey: 'dev_twitter_key',
    facebookEnabled: true,
    linkedinEnabled: true,
    instagramEnabled: false, // More complex setup
  },
  
  // Sample posts with social sharing enabled
  samplePosts: [
    {
      title: 'Test Social Media Integration',
      content: 'This is a test post to validate social media sharing functionality.',
      socialSharing: {
        enabled: true,
        autoPost: false,
        platforms: ['twitter', 'facebook'],
        customMessage: 'Testing social media integration for Royalti.io!',
        shareButtons: {
          enabled: true,
          position: 'both',
        },
      },
    },
  ],
}
```

## Testing Integration with Existing Projects

### Integration Test Suite
```typescript
// __tests__/integration/existingProject.test.ts
describe('Integration with Existing PayloadCMS Projects', () => {
  let payload: Payload
  
  beforeAll(async () => {
    payload = await initPayloadTest()
  })
  
  test('should install plugin without breaking existing functionality', async () => {
    // Test that existing collections still work
    const existingPost = await payload.create({
      collection: 'posts',
      data: {
        title: 'Test Post',
        content: 'Test content',
      },
    })
    
    expect(existingPost.title).toBe('Test Post')
    expect(existingPost.socialSharing).toBeDefined()
    expect(existingPost.socialSharing.enabled).toBe(false) // Default disabled
  })
  
  test('should preserve existing post data during migration', async () => {
    // Create posts before migration
    const originalPosts = await createTestPosts(payload, 10)
    
    // Run migration
    await runSocialMediaMigration(payload)
    
    // Verify data preservation
    for (const originalPost of originalPosts) {
      const migratedPost = await payload.findByID({
        collection: 'posts',
        id: originalPost.id,
      })
      
      expect(migratedPost.title).toBe(originalPost.title)
      expect(migratedPost.content).toBe(originalPost.content)
      expect(migratedPost.socialSharing).toBeDefined()
    }
  })
  
  test('should handle plugin updates without data loss', async () => {
    // Create posts with social sharing enabled
    const postsWithSharing = await createPostsWithSharing(payload, 5)
    
    // Simulate plugin update with migration
    await runUpdateMigration(payload, '1.0.0', '2.0.0')
    
    // Verify social sharing settings preserved
    for (const post of postsWithSharing) {
      const updatedPost = await payload.findByID({
        collection: 'posts',
        id: post.id,
      })
      
      expect(updatedPost.socialSharing.enabled).toBe(true)
      expect(updatedPost.socialSharing.platforms).toEqual(post.socialSharing.platforms)
    }
  })
})
```

This integration guide ensures that the social media plugin can be safely and seamlessly integrated into existing PayloadCMS projects like Royalti.io, with comprehensive data preservation, migration procedures, and zero-downtime update processes.
