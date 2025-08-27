import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import {
  Lock,
  Unlock,
  TrendingUp,
  Award,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Info
} from 'lucide-react'
import { useValidation } from '../hooks/useValidation'
import { useAuth } from '../contexts/AuthContext'
import type { StakingRequest } from '../types/validation'

interface StakingFormData {
  amount: string
  token: string
  network: string
  duration: number
}

const SUPPORTED_TOKENS = [
  { symbol: 'ZETA', name: 'ZetaChain', network: 'zetachain', decimals: 18 },
  { symbol: 'ETH', name: 'Ethereum', network: 'ethereum', decimals: 18 },
  { symbol: 'USDC', name: 'USD Coin', network: 'ethereum', decimals: 6 },
  { symbol: 'BTC', name: 'Bitcoin', network: 'bitcoin', decimals: 8 }
]

const STAKING_DURATIONS = [
  { days: 30, label: '30 Days', multiplier: 1.0, apy: 8 },
  { days: 90, label: '90 Days', multiplier: 1.2, apy: 12 },
  { days: 180, label: '180 Days', multiplier: 1.5, apy: 18 },
  { days: 365, label: '1 Year', multiplier: 2.0, apy: 25 }
]

export function ValidatorStaking() {
  const { isAuthenticated } = useAuth()
  const {
    validatorStake,
    stats,
    isStaking,
    stakeTokens,
    unstakeTokens,
    loadValidatorStake,
    formatTokenAmount
  } = useValidation()

  const [showStakeForm, setShowStakeForm] = useState(false)
  // const [selectedDuration] = useState(STAKING_DURATIONS[1])

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset
  } = useForm<StakingFormData>({
    defaultValues: {
      amount: '',
      token: 'ZETA',
      network: 'zetachain',
      duration: 90
    }
  })

  const watchedAmount = watch('amount')
  const watchedToken = watch('token')
  const watchedDuration = watch('duration')

  const selectedToken = SUPPORTED_TOKENS.find(t => t.symbol === watchedToken)
  const durationInfo = STAKING_DURATIONS.find(d => d.days === watchedDuration)

  const calculateRewards = useCallback((amount: string, duration: number) => {
    if (!amount || !duration) return { daily: '0', total: '0' }

    const durationInfo = STAKING_DURATIONS.find(d => d.days === duration)
    if (!durationInfo) return { daily: '0', total: '0' }

    const amountNum = parseFloat(amount)
    const annualReward = amountNum * (durationInfo.apy / 100)
    const totalReward = annualReward * (duration / 365) * durationInfo.multiplier
    const dailyReward = totalReward / duration

    return {
      daily: dailyReward.toFixed(4),
      total: totalReward.toFixed(4)
    }
  }, [])

  const onStake = useCallback(async (data: StakingFormData) => {
    const stakingRequest: StakingRequest = {
      amount: data.amount,
      token: data.token,
      network: data.network,
      duration: data.duration
    }

    const success = await stakeTokens(stakingRequest)

    if (success) {
      setShowStakeForm(false)
      reset()
      await loadValidatorStake()
    }
  }, [stakeTokens, reset, loadValidatorStake])

  const handleUnstake = useCallback(async () => {
    const success = await unstakeTokens()

    if (success) {
      await loadValidatorStake()
    }
  }, [unstakeTokens, loadValidatorStake])

  const isUnstakeAvailable = validatorStake && new Date() >= validatorStake.lockedUntil
  const rewards = calculateRewards(watchedAmount, watchedDuration)

  if (!isAuthenticated) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-600">Please connect your wallet to access validator staking</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Validator Staking</h1>
        <p className="text-gray-600">Stake tokens to become a validator and earn rewards</p>
      </div>

      {/* Current Stake Status */}
      {validatorStake ? (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Current Stake</h2>
            <div className="flex items-center space-x-2">
              <Lock className="h-5 w-5 text-green-500" />
              <span className="text-sm text-green-600 font-medium">Active Validator</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900">Staked Amount</span>
                <DollarSign className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {formatTokenAmount(validatorStake.amount)} {validatorStake.token}
              </p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-900">Reputation</span>
                <Award className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-600">
                {validatorStake.reputation}/100
              </p>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-900">Accuracy</span>
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-purple-600">
                {(validatorStake.accuracyScore * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              <span>
                Locked until: {validatorStake.lockedUntil.toLocaleDateString()}
                {isUnstakeAvailable && (
                  <span className="ml-2 text-green-600 font-medium">(Available for unstaking)</span>
                )}
              </span>
            </div>

            {isUnstakeAvailable && (
              <button
                onClick={handleUnstake}
                disabled={isStaking}
                className="btn-secondary flex items-center"
              >
                {isStaking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Unstaking...
                  </>
                ) : (
                  <>
                    <Unlock className="h-4 w-4 mr-2" />
                    Unstake
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card text-center">
          <div className="py-8">
            <Lock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Active Stake</h2>
            <p className="text-gray-600 mb-6">
              Stake tokens to become a validator and start earning rewards
            </p>
            <button
              onClick={() => setShowStakeForm(true)}
              className="btn-primary"
            >
              Start Staking
            </button>
          </div>
        </div>
      )}

      {/* Validator Stats */}
      {stats && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Validator Statistics</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary-600">{stats.totalValidations}</p>
              <p className="text-sm text-gray-600">Total Validations</p>
            </div>

            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.accuracyRate.toFixed(1)}%</p>
              <p className="text-sm text-gray-600">Accuracy Rate</p>
            </div>

            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {formatTokenAmount(stats.totalEarned)}
              </p>
              <p className="text-sm text-gray-600">Total Earned</p>
            </div>

            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">#{stats.rank}</p>
              <p className="text-sm text-gray-600">Global Rank</p>
            </div>
          </div>
        </div>
      )}

      {/* Staking Form */}
      {showStakeForm && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Stake Tokens</h2>
            <button
              onClick={() => setShowStakeForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit(onStake)} className="space-y-6">
            {/* Token Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Token
              </label>
              <select
                {...register('token', { required: 'Token is required' })}
                className="input-field"
                onChange={(e) => {
                  const token = SUPPORTED_TOKENS.find(t => t.symbol === e.target.value)
                  if (token) {
                    // Network is automatically set based on token selection
                  }
                }}
              >
                {SUPPORTED_TOKENS.map(token => (
                  <option key={token.symbol} value={token.symbol}>
                    {token.name} ({token.symbol})
                  </option>
                ))}
              </select>
              {errors.token && (
                <p className="mt-1 text-sm text-red-600">{errors.token.message}</p>
              )}
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount to Stake
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  {...register('amount', {
                    required: 'Amount is required',
                    min: { value: 0.000001, message: 'Amount must be greater than 0' }
                  })}
                  className="input-field pr-16"
                  placeholder="0.00"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-sm text-gray-500">{selectedToken?.symbol}</span>
                </div>
              </div>
              {errors.amount && (
                <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
              )}
            </div>

            {/* Duration Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Staking Duration
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {STAKING_DURATIONS.map(duration => (
                  <label
                    key={duration.days}
                    className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${watchedDuration === duration.days
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-300 bg-white hover:bg-gray-50'
                      }`}
                  >
                    <input
                      type="radio"
                      value={duration.days}
                      {...register('duration', { required: 'Duration is required' })}
                      className="sr-only"
                    />
                    <div className="flex flex-col">
                      <span className="block text-sm font-medium text-gray-900">
                        {duration.label}
                      </span>
                      <span className="block text-sm text-gray-500">
                        {duration.apy}% APY
                      </span>
                      <span className="block text-xs text-green-600">
                        {duration.multiplier}x multiplier
                      </span>
                    </div>
                    {watchedDuration === duration.days && (
                      <CheckCircle className="h-5 w-5 text-primary-600 absolute top-2 right-2" />
                    )}
                  </label>
                ))}
              </div>
              {errors.duration && (
                <p className="mt-1 text-sm text-red-600">{errors.duration.message}</p>
              )}
            </div>

            {/* Rewards Calculation */}
            {watchedAmount && durationInfo && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
                  <h3 className="text-sm font-medium text-green-900">Estimated Rewards</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-green-700">Daily Rewards:</span>
                    <span className="font-medium ml-2">{rewards.daily} {selectedToken?.symbol}</span>
                  </div>
                  <div>
                    <span className="text-green-700">Total Rewards:</span>
                    <span className="font-medium ml-2">{rewards.total} {selectedToken?.symbol}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Important Information:</p>
                  <ul className="space-y-1 text-blue-700">
                    <li>• Staked tokens will be locked for the selected duration</li>
                    <li>• Rewards are distributed daily based on validation performance</li>
                    <li>• Higher accuracy and consensus participation increase rewards</li>
                    <li>• Early unstaking may result in penalties</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setShowStakeForm(false)}
                className="btn-secondary"
                disabled={isStaking}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isStaking || !watchedAmount}
                className="btn-primary flex items-center justify-center"
              >
                {isStaking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Staking...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Stake Tokens
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Benefits */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Validator Benefits</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-2">Earn Rewards</h3>
            <p className="text-sm text-gray-600">
              Earn tokens for validating data submissions with high accuracy
            </p>
          </div>

          <div className="text-center">
            <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <Award className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-2">Build Reputation</h3>
            <p className="text-sm text-gray-600">
              Increase your validator reputation and unlock higher reward tiers
            </p>
          </div>

          <div className="text-center">
            <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-2">Governance Rights</h3>
            <p className="text-sm text-gray-600">
              Participate in platform governance and shape the future of DeLangZeta
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}