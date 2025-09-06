import type { ConnectionTestResult, SocialPlatform } from '../types';

/**
 * Connection Test Storage Utility
 * 
 * Manages storing and retrieving connection test results for the admin interface.
 * This provides a way to show connection status and timestamp information.
 */

export interface StoredConnectionTestResult extends ConnectionTestResult {
  platform: SocialPlatform;
  timestamp: string;
  credentialsHash?: string; // Hash of credentials to detect changes
}

/**
 * In-memory storage for connection test results
 * In a real implementation, this would likely use a database or cache
 */
const connectionTestCache = new Map<string, StoredConnectionTestResult>();

/**
 * Generate a simple hash for credentials to detect changes
 */
function generateCredentialsHash(credentials: Record<string, string>): string {
  const sortedKeys = Object.keys(credentials).sort();
  const credentialString = sortedKeys
    .map(key => `${key}:${credentials[key]?.substring(0, 8) || ''}`) // Only use first 8 chars for security
    .join('|');
  
  // Simple hash function (in production, use a proper hash like SHA-256)
  let hash = 0;
  for (let i = 0; i < credentialString.length; i++) {
    const char = credentialString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate a cache key for a platform and user combination
 */
function getCacheKey(platform: SocialPlatform, userId?: string): string {
  return `${platform}-${userId || 'anonymous'}`;
}

/**
 * Store a connection test result
 */
export function storeConnectionTestResult(
  platform: SocialPlatform,
  result: ConnectionTestResult,
  credentials: Record<string, string>,
  userId?: string
): void {
  const key = getCacheKey(platform, userId);
  const credentialsHash = generateCredentialsHash(credentials);
  
  const storedResult: StoredConnectionTestResult = {
    ...result,
    platform,
    timestamp: new Date().toISOString(),
    credentialsHash
  };
  
  connectionTestCache.set(key, storedResult);
  
  console.log(`[ConnectionTestStorage] Stored ${platform} test result for user ${userId || 'anonymous'}: ${result.success ? 'success' : 'failed'}`);
}

/**
 * Retrieve the last connection test result for a platform
 */
export function getLastConnectionTestResult(
  platform: SocialPlatform,
  credentials: Record<string, string>,
  userId?: string
): StoredConnectionTestResult | null {
  const key = getCacheKey(platform, userId);
  const stored = connectionTestCache.get(key);
  
  if (!stored) {
    return null;
  }
  
  // Check if credentials have changed
  const currentCredentialsHash = generateCredentialsHash(credentials);
  if (stored.credentialsHash !== currentCredentialsHash) {
    console.log(`[ConnectionTestStorage] Credentials changed for ${platform}, invalidating cached result`);
    connectionTestCache.delete(key);
    return null;
  }
  
  return stored;
}

/**
 * Clear connection test results for a platform
 */
export function clearConnectionTestResult(
  platform: SocialPlatform,
  userId?: string
): void {
  const key = getCacheKey(platform, userId);
  connectionTestCache.delete(key);
  console.log(`[ConnectionTestStorage] Cleared ${platform} test result for user ${userId || 'anonymous'}`);
}

/**
 * Clear all connection test results for a user
 */
export function clearAllConnectionTestResults(userId?: string): void {
  const keysToDelete = Array.from(connectionTestCache.keys())
    .filter(key => key.endsWith(`-${userId || 'anonymous'}`));
  
  keysToDelete.forEach(key => connectionTestCache.delete(key));
  console.log(`[ConnectionTestStorage] Cleared all test results for user ${userId || 'anonymous'}`);
}

/**
 * Get connection test statistics
 */
export function getConnectionTestStats(): {
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  platformStats: Record<SocialPlatform, { total: number; successful: number; failed: number }>;
} {
  const results = Array.from(connectionTestCache.values());
  const stats = {
    totalTests: results.length,
    successfulTests: results.filter(r => r.success).length,
    failedTests: results.filter(r => !r.success).length,
    platformStats: {} as Record<SocialPlatform, { total: number; successful: number; failed: number }>
  };
  
  // Calculate platform-specific stats
  const platforms: SocialPlatform[] = ['twitter', 'linkedin'];
  platforms.forEach(platform => {
    const platformResults = results.filter(r => r.platform === platform);
    stats.platformStats[platform] = {
      total: platformResults.length,
      successful: platformResults.filter(r => r.success).length,
      failed: platformResults.filter(r => !r.success).length
    };
  });
  
  return stats;
}

/**
 * Check if a connection test result is recent (within the last 5 minutes)
 */
export function isRecentTest(result: StoredConnectionTestResult): boolean {
  const testTime = new Date(result.timestamp).getTime();
  const now = new Date().getTime();
  const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  return (now - testTime) < fiveMinutes;
}

/**
 * Format connection test result for display
 */
export function formatConnectionTestResult(result: StoredConnectionTestResult): string {
  const status = result.success ? '✅ Connected' : '❌ Failed';
  const timestamp = new Date(result.timestamp).toLocaleString();
  const platform = result.platform.charAt(0).toUpperCase() + result.platform.slice(1);
  
  let details = '';
  if (result.success && result.details?.user) {
    details = ` (${result.details.user.username})`;
  } else if (!result.success && result.error) {
    details = ` - ${result.error.substring(0, 50)}${result.error.length > 50 ? '...' : ''}`;
  }
  
  return `${platform}: ${status}${details} - ${timestamp}`;
}