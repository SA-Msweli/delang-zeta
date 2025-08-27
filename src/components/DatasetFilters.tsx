import { useState } from 'react'
import {
  Search,
  X,
  ChevronDown,
  SlidersHorizontal,
  Star,
  DollarSign,
  Database,
  Shield
} from 'lucide-react'
import type { DatasetFilters, DatasetCategory, DatasetSortOption } from '../types/dataset'

interface DatasetFiltersProps {
  filters: DatasetFilters
  onFiltersChange: (filters: Partial<DatasetFilters>) => void
  onReset: () => void
  facets?: {
    categories: Array<{ value: string; count: number }>
    languages: Array<{ value: string; count: number }>
    dataTypes: Array<{ value: string; count: number }>
  }
  className?: string
}

export function DatasetFilters({
  filters,
  onFiltersChange,
  onReset,
  facets,
  className = ''
}: DatasetFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [priceRange, setPriceRange] = useState({
    min: filters.minPrice?.toString() || '',
    max: filters.maxPrice?.toString() || ''
  })

  const categories: Array<{ value: DatasetCategory; label: string }> = [
    { value: 'conversational', label: 'Conversational' },
    { value: 'technical', label: 'Technical' },
    { value: 'creative', label: 'Creative' },
    { value: 'educational', label: 'Educational' },
    { value: 'news', label: 'News & Media' },
    { value: 'social', label: 'Social Media' },
    { value: 'scientific', label: 'Scientific' },
    { value: 'legal', label: 'Legal' },
    { value: 'medical', label: 'Medical' },
    { value: 'financial', label: 'Financial' },
    { value: 'entertainment', label: 'Entertainment' },
    { value: 'other', label: 'Other' }
  ]

  const dataTypes = [
    { value: 'text', label: 'Text' },
    { value: 'audio', label: 'Audio' },
    { value: 'image', label: 'Image' },
    { value: 'video', label: 'Video' },
    { value: 'multimodal', label: 'Multimodal' }
  ]

  const sortOptions: Array<{ value: DatasetSortOption; label: string }> = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'price_low', label: 'Price: Low to High' },
    { value: 'price_high', label: 'Price: High to Low' },
    { value: 'quality', label: 'Highest Quality' },
    { value: 'rating', label: 'Highest Rated' },
    { value: 'downloads', label: 'Most Downloaded' },
    { value: 'relevance', label: 'Most Relevant' }
  ]

  const languages = [
    'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
    'Russian', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi',
    'Dutch', 'Swedish', 'Norwegian', 'Danish', 'Finnish', 'Polish',
    'Czech', 'Hungarian', 'Romanian', 'Bulgarian', 'Greek', 'Turkish',
    'Hebrew', 'Thai', 'Vietnamese', 'Indonesian', 'Malay', 'Tagalog'
  ]

  const handlePriceRangeChange = (field: 'min' | 'max', value: string) => {
    const newRange = { ...priceRange, [field]: value }
    setPriceRange(newRange)

    // Update filters with debounce
    const timeoutId = setTimeout(() => {
      onFiltersChange({
        minPrice: newRange.min ? parseFloat(newRange.min) : undefined,
        maxPrice: newRange.max ? parseFloat(newRange.max) : undefined
      })
    }, 500)

    return () => clearTimeout(timeoutId)
  }

  const getActiveFiltersCount = () => {
    let count = 0
    if (filters.search) count++
    if (filters.category) count++
    if (filters.language) count++
    if (filters.dataType) count++
    if (filters.minPrice) count++
    if (filters.maxPrice) count++
    if (filters.minQuality) count++
    if (filters.verified !== undefined) count++
    if (filters.hasPreview !== undefined) count++
    return count
  }

  const activeFiltersCount = getActiveFiltersCount()

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      {/* Search Bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search datasets by title, description, or tags..."
          value={filters.search || ''}
          onChange={(e) => onFiltersChange({ search: e.target.value || undefined })}
          className="input-field pl-10 pr-4"
        />
        {filters.search && (
          <button
            onClick={() => onFiltersChange({ search: undefined })}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Quick Filters Row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Category Filter */}
        <div className="relative">
          <select
            value={filters.category || ''}
            onChange={(e) => onFiltersChange({ category: e.target.value as DatasetCategory || undefined })}
            className="input-field text-sm pr-8 appearance-none cursor-pointer"
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category.value} value={category.value}>
                {category.label}
                {facets?.categories.find(f => f.value === category.value)?.count &&
                  ` (${facets.categories.find(f => f.value === category.value)?.count})`
                }
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Data Type Filter */}
        <div className="relative">
          <select
            value={filters.dataType || ''}
            onChange={(e) => onFiltersChange({ dataType: e.target.value || undefined })}
            className="input-field text-sm pr-8 appearance-none cursor-pointer"
          >
            <option value="">All Types</option>
            {dataTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
                {facets?.dataTypes.find(f => f.value === type.value)?.count &&
                  ` (${facets.dataTypes.find(f => f.value === type.value)?.count})`
                }
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Sort By */}
        <div className="relative">
          <select
            value={filters.sortBy || 'newest'}
            onChange={(e) => onFiltersChange({ sortBy: e.target.value as DatasetSortOption })}
            className="input-field text-sm pr-8 appearance-none cursor-pointer"
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Advanced Filters Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`btn-secondary text-sm flex items-center gap-2 ${showAdvanced ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Advanced
          {activeFiltersCount > 0 && (
            <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] h-5 flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </button>

        {/* Reset Filters */}
        {activeFiltersCount > 0 && (
          <button
            onClick={onReset}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <X className="h-4 w-4" />
            Clear all
          </button>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <div className="border-t border-gray-200 pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Language Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Language
              </label>
              <div className="relative">
                <select
                  value={filters.language || ''}
                  onChange={(e) => onFiltersChange({ language: e.target.value || undefined })}
                  className="input-field text-sm pr-8 appearance-none cursor-pointer w-full"
                >
                  <option value="">All Languages</option>
                  {languages.map(language => (
                    <option key={language} value={language}>
                      {language}
                      {facets?.languages.find(f => f.value === language)?.count &&
                        ` (${facets.languages.find(f => f.value === language)?.count})`
                      }
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                Price Range (USD)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={priceRange.min}
                  onChange={(e) => handlePriceRangeChange('min', e.target.value)}
                  className="input-field text-sm flex-1"
                  min="0"
                  step="0.01"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={priceRange.max}
                  onChange={(e) => handlePriceRangeChange('max', e.target.value)}
                  className="input-field text-sm flex-1"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* Quality Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                <Star className="h-4 w-4" />
                Minimum Quality
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={filters.minQuality || 0}
                onChange={(e) => onFiltersChange({ minQuality: parseInt(e.target.value) || undefined })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0%</span>
                <span className="font-medium text-gray-700">{filters.minQuality || 0}%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Boolean Filters */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.verified === true}
                onChange={(e) => onFiltersChange({ verified: e.target.checked ? true : undefined })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-sm text-gray-700">Verified only</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.hasPreview === true}
                onChange={(e) => onFiltersChange({ hasPreview: e.target.checked ? true : undefined })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <Database className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-gray-700">Has preview</span>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}