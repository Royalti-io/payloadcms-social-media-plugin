import React, { useCallback } from 'react';
import ConnectionTestButton from './ConnectionTestButton';
import type { ConnectionTestResult } from '../../types';

// Placeholder for PayloadCMS form hooks - in actual implementation, these would be imported from 'payload/components/forms'
interface FormData {
  platforms?: {
    twitter?: {
      apiKey?: string;
      apiSecret?: string;
      accessToken?: string;
      accessTokenSecret?: string;
      bearerToken?: string;
    };
  };
}

interface MockFormHook {
  getDataByPath: (path: string) => any;
}

const mockUseForm = (): MockFormHook => ({
  getDataByPath: (path: string) => {
    // This would normally get data from PayloadCMS form context
    // For demo purposes, return empty string
    return '';
  }
});

/**
 * Twitter Connection Test Field Component
 * 
 * A custom admin field that integrates with PayloadCMS forms to test Twitter API credentials.
 * It extracts the Twitter credentials from the form data and passes them to the ConnectionTestButton.
 */
const TwitterConnectionTestField: React.FC = () => {
  const { getDataByPath } = mockUseForm();

  // Get Twitter credentials from form data
  const twitterApiKey = getDataByPath('platforms.twitter.apiKey') as string;
  const twitterApiSecret = getDataByPath('platforms.twitter.apiSecret') as string;
  const twitterAccessToken = getDataByPath('platforms.twitter.accessToken') as string;
  const twitterAccessTokenSecret = getDataByPath('platforms.twitter.accessTokenSecret') as string;
  const twitterBearerToken = getDataByPath('platforms.twitter.bearerToken') as string;
  
  // Prepare credentials object
  const credentials = {
    apiKey: twitterApiKey || '',
    apiSecret: twitterApiSecret || '',
    accessToken: twitterAccessToken || '',
    accessTokenSecret: twitterAccessTokenSecret || '',
    bearerToken: twitterBearerToken || ''
  };

  // Check if credentials are provided
  const hasRequiredCredentials = !!(
    credentials.apiKey && 
    credentials.apiSecret && 
    credentials.accessToken && 
    credentials.accessTokenSecret
  );

  // Handle test completion
  const handleTestComplete = useCallback((result: ConnectionTestResult) => {
    // You can add additional logic here, such as storing the test result
    console.log('Twitter connection test completed:', result);
  }, []);

  return (
    <div className="field-type-ui">
      <div className="field-label">
        <label>Twitter Connection Test</label>
      </div>
      
      <div className="field-description">
        {hasRequiredCredentials 
          ? 'Click the button below to test your Twitter API connection.'
          : 'Please fill in all required Twitter credentials above before testing the connection.'
        }
      </div>

      <div className="field-value" style={{ marginTop: '12px' }}>
        {hasRequiredCredentials ? (
          <ConnectionTestButton
            platform="twitter"
            credentials={credentials}
            onTestComplete={handleTestComplete}
            size="medium"
          />
        ) : (
          <div className="connection-test-placeholder">
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-yellow-800">
              <div className="flex items-center space-x-2">
                <span className="text-yellow-500">⚠️</span>
                <span className="font-medium">Missing Credentials</span>
              </div>
              <div className="mt-2 text-sm">
                Please provide the following Twitter credentials to test the connection:
                <ul className="mt-2 ml-4 list-disc space-y-1">
                  {!credentials.apiKey && <li>API Key (Consumer Key)</li>}
                  {!credentials.apiSecret && <li>API Secret (Consumer Secret)</li>}
                  {!credentials.accessToken && <li>Access Token</li>}
                  {!credentials.accessTokenSecret && <li>Access Token Secret</li>}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TwitterConnectionTestField;