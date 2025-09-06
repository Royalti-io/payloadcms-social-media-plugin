import React, { useCallback } from 'react';
import ConnectionTestButton from './ConnectionTestButton';
import type { ConnectionTestResult } from '../../types';

// Placeholder for PayloadCMS form hooks - in actual implementation, these would be imported from 'payload/components/forms'
interface MockFormHook {
  getDataByPath: (path: string) => any;
}

const mockUseForm = (): MockFormHook => ({
  getDataByPath: (_path: string) => {
    // This would normally get data from PayloadCMS form context
    // For demo purposes, return empty string
    return '';
  }
});

/**
 * LinkedIn Connection Test Field Component
 * 
 * A custom admin field that integrates with PayloadCMS forms to test LinkedIn API credentials.
 * It extracts the LinkedIn credentials from the form data and passes them to the ConnectionTestButton.
 */
const LinkedInConnectionTestField: React.FC = () => {
  const { getDataByPath } = mockUseForm();

  // Get LinkedIn credentials from form data
  const linkedinAccessToken = getDataByPath('platforms.linkedin.accessToken') as string;
  const linkedinOrganizationId = getDataByPath('platforms.linkedin.organizationId') as string;
  
  // Prepare credentials object
  const credentials = {
    accessToken: linkedinAccessToken || '',
    organizationId: linkedinOrganizationId || ''
  };

  // Check if credentials are provided
  const hasRequiredCredentials = !!(credentials.accessToken);

  // Handle test completion
  const handleTestComplete = useCallback((result: ConnectionTestResult) => {
    // You can add additional logic here, such as storing the test result
    console.log('LinkedIn connection test completed:', result);
  }, []);

  return (
    <div className="field-type-ui">
      <div className="field-label">
        <label>LinkedIn Connection Test</label>
      </div>
      
      <div className="field-description">
        {hasRequiredCredentials 
          ? 'Click the button below to test your LinkedIn API connection.'
          : 'Please provide your LinkedIn access token above before testing the connection.'
        }
      </div>

      <div className="field-value" style={{ marginTop: '12px' }}>
        {hasRequiredCredentials ? (
          <ConnectionTestButton
            platform="linkedin"
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
                Please provide your LinkedIn access token to test the connection.
                {credentials.organizationId && (
                  <div className="mt-2">
                    <span className="font-medium">Organization ID:</span> {credentials.organizationId}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LinkedInConnectionTestField;