# PayloadCMS Social Media Plugin - Migrations & Updates

## Overview
This guide covers how to handle database migrations, plugin updates, and data management for the PayloadCMS Social Media Plugin.

## Plugin Update Strategy

### Semantic Versioning
The plugin follows [Semantic Versioning](https://semver.org/):
- **Major (X.0.0)**: Breaking changes, requires migration
- **Minor (1.X.0)**: New features, backward compatible
- **Patch (1.0.X)**: Bug fixes, backward compatible

### Update Process
```bash
# Check current version
npm list @payloadcms/plugin-social-media

# Update to latest version
npm update @payloadcms/plugin-social-media

# Or update to specific version
npm install @payloadcms/plugin-social-media@^2.0.0

# Check for breaking changes
cat node_modules/@payloadcms/plugin-social-media/CHANGELOG.md
```

## Migration System

### Automatic Migrations
The plugin includes an automatic migration system that runs when:
- Plugin version changes
- Database schema needs updates
- New features require data structure changes

### Migration Files Structure
```
src/migrations/
├── 001-initial-setup.ts           # v1.0.0 - Initial plugin setup
├── 002-add-instagram-support.ts   # v1.1.0 - Add Instagram integration
├── 003-encryption-upgrade.ts      # v1.2.0 - Enhanced encryption
├── 004-analytics-tracking.ts      # v1.3.0 - Add analytics features
└── 005-webhook-integration.ts     # v2.0.0 - Major webhook system
```

### Migration Implementation Example
```typescript
// src/migrations/002-add-instagram-support.ts
import { MigrationConfig } from 'payload'

export const addInstagramSupport: MigrationConfig = {
  version: '1.1.0',
  description: 'Add Instagram integration support',
  up: async ({ payload, req }) => {
    try {
      console.log('🔄 Adding Instagram support...')
      
      // Update existing social media settings
      const existingSettings = await payload.findGlobal({
        slug: 'social-media-settings',
        req,
      })
      
      if (existingSettings) {
        await payload.updateGlobal({
          slug: 'social-media-settings',
          data: {
            ...existingSettings,
            instagramEnabled: false,
            instagramBusinessAccountId: '',
            // Preserve existing settings while adding new fields
          },
          req,
        })
      }
      
      // Update existing collection documents
      const collections = ['posts', 'pages'] // Get from plugin config
      
      for (const collectionSlug of collections) {
        const { docs } = await payload.find({
          collection: collectionSlug,
          limit: 1000,
          req,
        })
        
        for (const doc of docs) {
          if (doc.socialSharing) {
            await payload.update({
              collection: collectionSlug,
              id: doc.id,
              data: {
                socialSharing: {
                  ...doc.socialSharing,
                  platforms: [...(doc.socialSharing.platforms || [])], // Keep existing
                  postingStatus: {
                    ...doc.socialSharing.postingStatus,
                    instagram: null, // Add Instagram status tracking
                  },
                },
              },
              req,
            })
          }
        }
      }
      
      console.log('✅ Instagram support added successfully')
    } catch (error) {
      console.error('❌ Migration failed:', error)
      throw error
    }
  },
  down: async ({ payload, req }) => {
    // Rollback logic if needed
    console.log('🔄 Rolling back Instagram support...')
    
    const existingSettings = await payload.findGlobal({
      slug: 'social-media-settings',
      req,
    })
    
    if (existingSettings) {
      // Remove Instagram-specific fields
      const { instagramEnabled, instagramBusinessAccountId, ...cleanSettings } = existingSettings
      
      await payload.updateGlobal({
        slug: 'social-media-settings',
        data: cleanSettings,
        req,
      })
    }
    
    console.log('✅ Instagram support rollback completed')
  },
}
```

### Migration Runner
```typescript
// src/utils/migrationRunner.ts
import { Payload } from 'payload'
import { MigrationConfig } from 'payload'

interface PluginMigration {
  version: string
  migration: MigrationConfig
  executed: boolean
  executedAt?: Date
}

export class MigrationRunner {
  private payload: Payload
  private migrations: MigrationConfig[]
  
  constructor(payload: Payload, migrations: MigrationConfig[]) {
    this.payload = payload
    this.migrations = migrations.sort((a, b) => 
      this.compareVersions(a.version, b.version)
    )
  }
  
  async runMigrations(): Promise<void> {
    try {
      console.log('🔄 Checking for plugin migrations...')
      
      // Get current plugin version and executed migrations
      const currentVersion = this.getCurrentPluginVersion()
      const executedMigrations = await this.getExecutedMigrations()
      
      // Find migrations that need to be executed
      const pendingMigrations = this.migrations.filter(migration => {
        const isExecuted = executedMigrations.some(em => em.version === migration.version)
        const isNewerVersion = this.compareVersions(migration.version, currentVersion) <= 0
        return !isExecuted && isNewerVersion
      })
      
      if (pendingMigrations.length === 0) {
        console.log('✅ No migrations needed')
        return
      }
      
      console.log(`🔄 Running ${pendingMigrations.length} migration(s)...`)
      
      // Execute migrations in order
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration)
      }
      
      console.log('✅ All migrations completed successfully')
    } catch (error) {
      console.error('❌ Migration failed:', error)
      throw error
    }
  }
  
  private async executeMigration(migration: MigrationConfig): Promise<void> {
    const startTime = Date.now()
    
    try {
      console.log(`🔄 Running migration ${migration.version}: ${migration.description}`)
      
      // Execute the migration
      await migration.up({
        payload: this.payload,
        req: { payload: this.payload } as any,
      })
      
      // Record successful execution
      await this.recordMigrationExecution(migration, true)
      
      const duration = Date.now() - startTime
      console.log(`✅ Migration ${migration.version} completed in ${duration}ms`)
    } catch (error) {
      // Record failed execution
      await this.recordMigrationExecution(migration, false, error.message)
      throw error
    }
  }
  
  private async getExecutedMigrations(): Promise<PluginMigration[]> {
    // Implementation to track executed migrations
    // This could be stored in a special collection or global
    try {
      const migrationTracker = await this.payload.findGlobal({
        slug: 'plugin-migrations',
      })
      
      return migrationTracker?.socialMediaPlugin?.migrations || []
    } catch {
      return []
    }
  }
  
  private async recordMigrationExecution(
    migration: MigrationConfig, 
    success: boolean, 
    error?: string
  ): Promise<void> {
    const executedMigrations = await this.getExecutedMigrations()
    
    const migrationRecord: PluginMigration = {
      version: migration.version,
      migration,
      executed: success,
      executedAt: new Date(),
    }
    
    const updatedMigrations = [
      ...executedMigrations.filter(m => m.version !== migration.version),
      migrationRecord,
    ]
    
    await this.payload.updateGlobal({
      slug: 'plugin-migrations',
      data: {
        socialMediaPlugin: {
          migrations: updatedMigrations,
          lastUpdated: new Date(),
          version: this.getCurrentPluginVersion(),
        },
      },
    })
  }
  
  private getCurrentPluginVersion(): string {
    // Get version from package.json
    try {
      const packageJson = require('../../package.json')
      return packageJson.version
    } catch {
      return '1.0.0'
    }
  }
  
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number)
    const parts2 = v2.split('.').map(Number)
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0
      const part2 = parts2[i] || 0
      
      if (part1 > part2) return 1
      if (part1 < part2) return -1
    }
    
    return 0
  }
}
```

## Data Backup and Recovery

### Pre-Update Backup
```typescript
// src/utils/backup.ts
export class PluginBackup {
  private payload: Payload
  
  constructor(payload: Payload) {
    this.payload = payload
  }
  
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupId = `social-media-plugin-${timestamp}`
    
    console.log(`🔄 Creating backup: ${backupId}`)
    
    try {
      // Backup global settings
      const settings = await this.payload.findGlobal({
        slug: 'social-media-settings',
      })
      
      // Backup collection data with social sharing fields
      const collectionsData = {}
      const collections = ['posts', 'pages'] // Get from plugin config
      
      for (const collectionSlug of collections) {
        const { docs } = await this.payload.find({
          collection: collectionSlug,
          limit: 10000, // Adjust based on needs
        })
        
        collectionsData[collectionSlug] = docs.map(doc => ({
          id: doc.id,
          socialSharing: doc.socialSharing,
        }))
      }
      
      const backupData = {
        backupId,
        timestamp: new Date(),
        version: this.getCurrentPluginVersion(),
        globalSettings: settings,
        collectionsData,
      }
      
      // Store backup (could be file system, database, or cloud storage)
      await this.storeBackup(backupId, backupData)
      
      console.log(`✅ Backup created: ${backupId}`)
      return backupId
    } catch (error) {
      console.error('❌ Backup failed:', error)
      throw error
    }
  }
  
  async restoreBackup(backupId: string): Promise<void> {
    console.log(`🔄 Restoring backup: ${backupId}`)
    
    try {
      const backupData = await this.retrieveBackup(backupId)
      
      if (!backupData) {
        throw new Error(`Backup not found: ${backupId}`)
      }
      
      // Restore global settings
      if (backupData.globalSettings) {
        await this.payload.updateGlobal({
          slug: 'social-media-settings',
          data: backupData.globalSettings,
        })
      }
      
      // Restore collection data
      for (const [collectionSlug, documents] of Object.entries(backupData.collectionsData)) {
        for (const doc of documents as any[]) {
          await this.payload.update({
            collection: collectionSlug,
            id: doc.id,
            data: {
              socialSharing: doc.socialSharing,
            },
          })
        }
      }
      
      console.log(`✅ Backup restored: ${backupId}`)
    } catch (error) {
      console.error('❌ Restore failed:', error)
      throw error
    }
  }
  
  private async storeBackup(backupId: string, data: any): Promise<void> {
    // Implementation depends on storage strategy
    // Options: File system, database collection, cloud storage
    
    // Example: Store in PayloadCMS collection
    await this.payload.create({
      collection: 'plugin-backups',
      data: {
        backupId,
        pluginName: 'social-media',
        data: JSON.stringify(data),
        createdAt: new Date(),
      },
    })
  }
  
  private async retrieveBackup(backupId: string): Promise<any> {
    const backup = await this.payload.find({
      collection: 'plugin-backups',
      where: {
        backupId: { equals: backupId },
        pluginName: { equals: 'social-media' },
      },
      limit: 1,
    })
    
    if (!backup.docs.length) {
      return null
    }
    
    return JSON.parse(backup.docs[0].data)
  }
}
```

## Update Procedures

### Minor Update (1.1.0 → 1.2.0)
```bash
# 1. Create backup (automatic in production)
npm run payload:backup-social-media

# 2. Update plugin
npm update @payloadcms/plugin-social-media

# 3. Restart application (migrations run automatically)
npm run build
npm restart

# 4. Verify functionality
npm run test:social-media-integration
```

### Major Update (1.x.x → 2.0.0)
```bash
# 1. Read breaking changes documentation
cat node_modules/@payloadcms/plugin-social-media/BREAKING_CHANGES.md

# 2. Create full backup
npm run payload:full-backup

# 3. Update plugin with force flag (if needed)
npm install @payloadcms/plugin-social-media@^2.0.0

# 4. Review and update configuration
# Check payload.config.ts for required changes

# 5. Run migration preview (optional)
npm run payload:migrate-preview

# 6. Execute migration
npm run payload:migrate

# 7. Test thoroughly
npm run test:all
```

## Seed Data Management

### Initial Seed Data
```typescript
// src/seeds/initialSetup.ts
export const socialMediaSeedData = {
  globals: {
    'social-media-settings': {
      defaultAutoPost: false,
      messageTemplate: '{{title}} - {{excerpt}}\n\n{{url}}',
      shareButtons: {
        enabled: true,
        style: 'buttons',
        position: 'bottom',
      },
      includeHashtags: true,
      
      // Platform defaults (disabled by default)
      twitterEnabled: false,
      facebookEnabled: false,
      linkedinEnabled: false,
      instagramEnabled: false,
    },
  },
}

export const seedSocialMediaSettings = async (payload: Payload): Promise<void> => {
  try {
    console.log('🌱 Seeding social media plugin data...')
    
    // Check if settings already exist
    const existingSettings = await payload.findGlobal({
      slug: 'social-media-settings',
    })
    
    if (!existingSettings) {
      await payload.updateGlobal({
        slug: 'social-media-settings',
        data: socialMediaSeedData.globals['social-media-settings'],
      })
      
      console.log('✅ Social media settings seeded successfully')
    } else {
      console.log('ℹ️ Social media settings already exist')
    }
  } catch (error) {
    console.error('❌ Failed to seed social media settings:', error)
    throw error
  }
}
```

### Development Seed Data
```typescript
// src/seeds/development.ts
export const developmentSeedData = {
  // Test API credentials (non-functional for security)
  globals: {
    'social-media-settings': {
      // Development/testing settings
      twitterEnabled: true,
      twitterApiKey: 'dev_twitter_api_key',
      twitterApiSecret: 'dev_twitter_api_secret',
      
      // Enable all platforms for testing
      facebookEnabled: true,
      linkedinEnabled: true,
      instagramEnabled: true,
      
      // Development-friendly settings
      defaultAutoPost: false, // Prevent accidental posting
      messageTemplate: '[DEV] {{title}} - {{excerpt}}\n\n{{url}}',
    },
  },
  
  // Sample posts with social sharing enabled
  collections: {
    posts: [
      {
        title: 'Sample Social Media Post',
        content: [
          {
            children: [
              { text: 'This is a sample post to test social media sharing functionality.' },
            ],
          },
        ],
        socialSharing: {
          enabled: true,
          autoPost: false,
          customMessage: 'Check out our latest blog post!',
          platforms: ['twitter', 'facebook'],
          shareButtons: {
            enabled: true,
            position: 'both',
          },
        },
      },
    ],
  },
}
```

## Configuration Migration Helpers

### Config Update Assistant
```typescript
// src/utils/configMigration.ts
export interface ConfigMigrationHelper {
  fromVersion: string
  toVersion: string
  migrate: (oldConfig: any) => any
  validate: (newConfig: any) => boolean
}

export const configMigrations: ConfigMigrationHelper[] = [
  {
    fromVersion: '1.0.0',
    toVersion: '2.0.0',
    migrate: (oldConfig) => {
      // Migrate v1 config to v2 format
      return {
        ...oldConfig,
        
        // Convert old platform array to new object format
        platforms: oldConfig.platforms?.reduce((acc, platform) => ({
          ...acc,
          [platform]: { enabled: true, autoPost: oldConfig.autoPost || false },
        }), {}) || {},
        
        // Migrate share button settings
        shareButtons: {
          enabled: oldConfig.shareButtons !== false,
          style: oldConfig.shareButtonStyle || 'buttons',
          position: oldConfig.shareButtonPosition || 'bottom',
          platforms: oldConfig.platforms || [],
        },
        
        // Remove deprecated options
        autoPost: undefined, // Moved to platform-specific config
        shareButtonStyle: undefined,
        shareButtonPosition: undefined,
      }
    },
    validate: (newConfig) => {
      return (
        typeof newConfig.platforms === 'object' &&
        typeof newConfig.shareButtons === 'object'
      )
    },
  },
]

export const migrateConfig = (oldConfig: any, targetVersion: string): any => {
  let migratedConfig = { ...oldConfig }
  
  for (const migration of configMigrations) {
    if (migration.toVersion === targetVersion) {
      migratedConfig = migration.migrate(migratedConfig)
      
      if (!migration.validate(migratedConfig)) {
        throw new Error(`Config migration to ${targetVersion} failed validation`)
      }
      
      break
    }
  }
  
  return migratedConfig
}
```

## Rollback Procedures

### Automatic Rollback
```typescript
// src/utils/rollback.ts
export class PluginRollback {
  private payload: Payload
  private backupManager: PluginBackup
  
  constructor(payload: Payload) {
    this.payload = payload
    this.backupManager = new PluginBackup(payload)
  }
  
  async rollbackToVersion(targetVersion: string): Promise<void> {
    console.log(`🔄 Rolling back to version ${targetVersion}...`)
    
    try {
      // Find most recent backup for target version
      const backup = await this.findBackupForVersion(targetVersion)
      
      if (!backup) {
        throw new Error(`No backup found for version ${targetVersion}`)
      }
      
      // Create current state backup before rollback
      const preRollbackBackup = await this.backupManager.createBackup()
      console.log(`💾 Pre-rollback backup created: ${preRollbackBackup}`)
      
      // Restore from backup
      await this.backupManager.restoreBackup(backup.backupId)
      
      // Run any necessary down migrations
      await this.runDownMigrations(targetVersion)
      
      console.log(`✅ Rollback to version ${targetVersion} completed`)
    } catch (error) {
      console.error('❌ Rollback failed:', error)
      throw error
    }
  }
  
  private async findBackupForVersion(version: string): Promise<any> {
    const backups = await this.payload.find({
      collection: 'plugin-backups',
      where: {
        pluginName: { equals: 'social-media' },
      },
      sort: '-createdAt',
      limit: 100,
    })
    
    for (const backup of backups.docs) {
      const backupData = JSON.parse(backup.data)
      if (backupData.version === version) {
        return { backupId: backup.backupId, data: backupData }
      }
    }
    
    return null
  }
  
  private async runDownMigrations(targetVersion: string): Promise<void> {
    // Implementation to run down migrations if needed
    console.log(`🔄 Running down migrations to ${targetVersion}...`)
    // This would run the `down` methods of migrations in reverse order
  }
}
```

## Update Notifications

### Admin Notification System
```typescript
// src/components/UpdateNotification.tsx
export const UpdateNotification: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<{
    hasUpdate: boolean
    currentVersion: string
    latestVersion: string
    breakingChanges: boolean
  } | null>(null)
  
  useEffect(() => {
    checkForUpdates()
  }, [])
  
  const checkForUpdates = async () => {
    try {
      const response = await fetch('/api/social-media/check-updates')
      const info = await response.json()
      setUpdateInfo(info)
    } catch (error) {
      console.error('Failed to check for updates:', error)
    }
  }
  
  if (!updateInfo?.hasUpdate) return null
  
  return (
    <div className="update-notification">
      <h3>Social Media Plugin Update Available</h3>
      <p>
        Version {updateInfo.latestVersion} is available 
        (current: {updateInfo.currentVersion})
      </p>
      
      {updateInfo.breakingChanges && (
        <div className="warning">
          ⚠️ This update includes breaking changes. 
          Please review the changelog before updating.
        </div>
      )}
      
      <div className="actions">
        <button onClick={() => window.open('/docs/social-media-plugin/changelog')}>
          View Changelog
        </button>
        <button onClick={() => window.open('/docs/social-media-plugin/migration')}>
          Migration Guide
        </button>
      </div>
    </div>
  )
}
```

This comprehensive migration and update system ensures:

1. **Automatic database migrations** when plugin versions change
2. **Backup and recovery** capabilities for safe updates
3. **Configuration migration helpers** for major version changes
4. **Rollback procedures** if updates fail
5. **Seed data management** for development and production
6. **Update notifications** to keep users informed

The system prioritizes data safety while providing smooth upgrade paths for users of all technical levels.
