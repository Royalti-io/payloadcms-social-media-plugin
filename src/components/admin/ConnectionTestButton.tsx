import React, { useState, useCallback } from 'react';
import type { ConnectionTestResult, SocialPlatform, ConnectionTestButtonProps } from '../../types';

/**
 * Connection Test Button Component
 * 
 * A React component that provides connection testing functionality for social media platforms.
 * Shows real-time status (testing, success, failed) and displays helpful error messages.
 */
export const ConnectionTestButton: React.FC<ConnectionTestButtonProps> = ({
  platform,
  credentials,
  onTestComplete,
  disabled = false,
  size = 'medium'
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<(ConnectionTestResult & { cached?: boolean; testedAt?: string }) | null>(null);
  const [lastTested, setLastTested] = useState<Date | null>(null);

  // Get platform-specific configuration
  const platformConfig = getPlatformConfig(platform);

  // Handle connection test
  const handleTest = useCallback(async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    setResult(null);

    try {
      // Call the API endpoint for testing
      const response = await fetch('/api/social-media/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          credentials
        })
      });

      const testResult: ConnectionTestResult & { cached?: boolean; testedAt?: string } = await response.json();
      setResult(testResult);
      
      // Use the server's timestamp if available, otherwise current time
      const testTime = testResult.testedAt ? new Date(testResult.testedAt) : new Date();
      setLastTested(testTime);
      
      // Notify parent component
      if (onTestComplete) {
        onTestComplete(testResult);
      }
    } catch (error) {
      const errorResult: ConnectionTestResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed',
        errorCode: undefined,
        retryable: undefined,
        details: undefined
      };
      setResult(errorResult);
      setLastTested(new Date());
      
      if (onTestComplete) {
        onTestComplete(errorResult);
      }
    } finally {
      setIsLoading(false);
    }
  }, [platform, credentials, disabled, isLoading, onTestComplete]);

  // Get button styling based on size
  const buttonClasses = {
    small: 'px-3 py-1 text-sm',
    medium: 'px-4 py-2 text-base',
    large: 'px-6 py-3 text-lg'
  };

  // Get status styling
  const getStatusStyle = () => {
    if (isLoading) return 'bg-yellow-500 text-white';
    if (result?.success) return 'bg-green-500 text-white';
    if (result && !result.success) return 'bg-red-500 text-white';
    return `bg-gray-100 text-gray-800 border border-gray-300 hover:bg-gray-50`;
  };

  return (
    <div className="connection-test-container space-y-3">
      {/* Main Test Button */}
      <button
        onClick={handleTest}
        disabled={disabled || isLoading}
        className={`
          ${buttonClasses[size]}
          ${getStatusStyle()}
          rounded-md font-medium transition-colors duration-200 
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center space-x-2
        `}
        style={{ 
          backgroundColor: isLoading || result ? undefined : platformConfig.color + '20',
          borderColor: isLoading || result ? undefined : platformConfig.color
        }}
      >
        <span className="text-lg">{platformConfig.icon}</span>
        <span>
          {isLoading 
            ? 'Testing...' 
            : result?.success 
            ? `${platformConfig.name} Connected` 
            : result && !result.success
            ? 'Connection Failed'
            : platformConfig.testLabel
          }
        </span>
        {isLoading && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
        )}
        {result?.cached && (
          <span className="text-xs opacity-75">(cached)</span>
        )}
      </button>

      {/* Connection Status Display */}
      {result && (
        <div className={`
          p-3 rounded-md text-sm
          ${result.success 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
          }
        `}>
          {result.success ? (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-green-500 font-bold">✓</span>
                <span className="font-medium">
                  Connection successful!
                  {result.cached && <span className="text-xs ml-2 opacity-75">(cached result)</span>}
                </span>
              </div>
              {result.details?.user && (
                <div className="pl-6 space-y-1 text-sm">
                  <div>
                    <strong>Account:</strong> @{result.details.user.username} ({result.details.user.name})
                  </div>
                  {result.details.user.verified && (
                    <div className="text-blue-600">✓ Verified account</div>
                  )}
                </div>
              )}
              {result.details?.organization && (
                <div className="pl-6 space-y-1 text-sm">
                  <div>
                    <strong>Organization:</strong> {result.details.organization.name}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-red-500 font-bold">✗</span>
                <span className="font-medium">Connection failed</span>
              </div>
              <div className="pl-6 text-sm">
                <p className="mb-2">{result.error}</p>
                <div className="text-gray-600">
                  <strong>Troubleshooting:</strong>
                  <ul className="mt-1 ml-4 list-disc space-y-1">
                    {platform === 'twitter' && (
                      <>
                        <li>Verify your API Key, API Secret, Access Token, and Access Token Secret are correct</li>
                        <li>Ensure your Twitter app has the necessary permissions (Read and Write)</li>
                        <li>Check that your system clock is synchronized</li>
                        <li>Confirm your Twitter Developer account is in good standing</li>
                        <li>Try regenerating your access tokens if the error persists</li>
                      </>
                    )}
                    {platform === 'linkedin' && (
                      <>
                        <li>Verify your LinkedIn Access Token is valid and not expired</li>
                        <li>Ensure your LinkedIn app has the necessary API permissions</li>
                        <li>Check if Organization ID is required for your use case</li>
                        <li>Confirm your LinkedIn Developer application is approved</li>
                        <li>Try generating a new access token from LinkedIn Developer Console</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Last Tested Info */}
      {lastTested && (
        <div className="text-xs text-gray-500">
          Last tested: {lastTested.toLocaleString()}
          {result?.cached && <span className="ml-2">(from cache)</span>}
        </div>
      )}
    </div>
  );
};

/**
 * Utility functions for connection testing
 */

/**
 * Get platform-specific configuration for UI
 */
export function getPlatformConfig(platform: SocialPlatform) {
  switch (platform) {
    case 'twitter':
      return {
        name: 'Twitter/X',
        color: '#1DA1F2',
        icon: '🐦',
        testLabel: 'Test Twitter Connection'
      };
    case 'linkedin':
      return {
        name: 'LinkedIn', 
        color: '#0077B5',
        icon: '💼',
        testLabel: 'Test LinkedIn Connection'
      };
    default:
      return {
        name: platform,
        color: '#666666',
        icon: '🔗',
        testLabel: 'Test Connection'
      };
  }
}

export default ConnectionTestButton;