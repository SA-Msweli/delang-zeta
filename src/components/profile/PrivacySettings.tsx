// Enhanced privacy settings component with mobile responsiveness and security

import React, { useState } from 'react'
import { userProfileService, PrivacySettings as PrivacyPrefs } from '../../services/userProfileService'
import { auditService } from '../../services/auditService'

interface PrivacySettingsProps {
  onUpdate?: () => void
}

export function PrivacySettings({ onUpdate }: PrivacySettingsProps) {
  const [settings, setSettings] = useState<PrivacyPrefs>({
    showProfile: true,
    showStatistics: true,
    showRewardHistory: false,
    showActivity: false,
    allowDataSharing: false
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setIsLoading(true)
      setError(null)
      setSuccess(false)

      // Log privacy settings update attempt for security audit
      await auditService.logActivity({
        action: 'privacy_settings_update_attempt',
        details: {
          showProfile: settings.showProfile,
          showStatistics: settings.showStatistics,
          allowDataSharing: settings.allowDataSharing
        },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      })

      await userProfileService.updatePrivacySettings(settings)

      setSuccess(true)
      onUpdate?.()

      // Log successful update
      await auditService.logActivity({
        action: 'privacy_settings_updated_success',
        details: { allowDataSharing: settings.allowDataSharing },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      })

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      console.error('Error updating privacy settings:', error)
      setError(error instanceof Error ? error.message : 'Failed to update privacy settings')

      // Log failed update
      await auditService.logActivity({
        action: 'privacy_settings_update_failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSettingChange = (key: keyof PrivacyPrefs, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }))

    // Log privacy setting change for security audit
    auditService.logActivity({
      action: 'privacy_setting_changed',
      details: { setting: key, value },
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      ipAddress: 'client-side'
    }).catch(console.error)
  }

  const privacyOptions = [
    {
      key: 'showProfile' as keyof PrivacyPrefs,
      title: 'Public Profile',
      description: 'Allow others to view your basic profile information',
      icon: (
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      recommended: true
    },
    {
      key: 'showStatistics' as keyof PrivacyPrefs,
      title: 'Public Statistics',
      description: 'Display your contribution and validation statistics publicly',
      icon: (
        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      recommended: true
    },
    {
      key: 'showRewardHistory' as keyof PrivacyPrefs,
      title: 'Public Reward History',
      description: 'Allow others to see your reward earnings and transaction history',
      icon: (
        <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
      ),
      recommended: false,
      warning: 'This will make your earnings visible to everyone'
    },
    {
      key: 'showActivity' as keyof PrivacyPrefs,
      title: 'Public Activity Feed',
      description: 'Display your recent platform activities publicly',
      icon: (
        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      recommended: false
    },
    {
      key: 'allowDataSharing' as keyof PrivacyPrefs,
      title: 'Anonymous Data Sharing',
      description: 'Allow anonymized usage data to be shared for platform improvement',
      icon: (
        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
        </svg>
      ),
      recommended: true,
      info: 'Helps improve the platform while keeping your identity private'
    }
  ]

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200">
      <div className="mb-4 sm:mb-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Privacy Settings</h3>
        <p className="text-gray-600 text-sm sm:text-base">
          Control what information is visible to other users and how your data is used
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
            </svg>
            <span className="text-green-800">Privacy settings updated successfully!</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Mobile-Optimized Privacy Options */}
        <div className="space-y-3 sm:space-y-4">
          {privacyOptions.map((option) => (
            <div key={option.key} className="border border-gray-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start space-x-2 sm:space-x-3 min-w-0 flex-1">
                  <div className="p-1.5 sm:p-2 bg-gray-50 rounded-lg flex-shrink-0">
                    {option.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 mb-1">
                      <h4 className="text-sm font-medium text-gray-900 truncate">{option.title}</h4>
                      {option.recommended && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full mt-1 sm:mt-0 self-start">
                          Recommended
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-2 line-clamp-2">{option.description}</p>

                    {option.warning && (
                      <div className="flex items-start space-x-1 text-xs text-orange-600 mb-2">
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <span className="line-clamp-2">{option.warning}</span>
                      </div>
                    )}

                    {option.info && (
                      <div className="flex items-start space-x-1 text-xs text-blue-600 mb-2">
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="line-clamp-2">{option.info}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSettingChange(option.key, !settings[option.key])}
                    className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${settings[option.key] ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings[option.key] ? 'translate-x-4 sm:translate-x-5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Data Rights Information */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-blue-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-blue-800">Your Data Rights</h4>
              <div className="text-sm text-blue-700 mt-1 space-y-1">
                <p>• You can change these settings at any time</p>
                <p>• You have the right to request deletion of your personal data</p>
                <p>• You can export your data in a machine-readable format</p>
                <p>• All blockchain transactions remain permanently recorded</p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile-Optimized Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
          >
            {isLoading ? 'Updating...' : 'Update Privacy Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}