import { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

interface Column<T> {
  key: keyof T | string
  header: string
  render?: (item: T, index: number) => ReactNode
  sortable?: boolean
  className?: string
  mobileHidden?: boolean
}

interface ResponsiveTableProps<T> {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (item: T, index: number) => void
  loading?: boolean
  emptyMessage?: string
  className?: string
  mobileCardView?: boolean
}

export function ResponsiveTable<T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
  loading = false,
  emptyMessage = 'No data available',
  className = '',
  mobileCardView = true
}: ResponsiveTableProps<T>) {

  // Get value from nested object path
  const getValue = (item: T, key: string) => {
    return key.split('.').reduce((obj, k) => obj?.[k], item)
  }

  // Render cell content
  const renderCell = (item: T, column: Column<T>, index: number) => {
    if (column.render) {
      return column.render(item, index)
    }

    const value = getValue(item, column.key as string)
    return value?.toString() || '-'
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
        {/* Desktop skeleton */}
        <div className="hidden md:block">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex space-x-4">
              {columns.map((_, index) => (
                <div key={index} className="h-4 bg-gray-200 rounded animate-pulse flex-1" />
              ))}
            </div>
          </div>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="px-6 py-4 border-b border-gray-100">
              <div className="flex space-x-4">
                {columns.map((_, colIndex) => (
                  <div key={colIndex} className="h-4 bg-gray-100 rounded animate-pulse flex-1" />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Mobile skeleton */}
        <div className="md:hidden space-y-4 p-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
                <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
        <div className="px-6 py-12 text-center">
          <div className="text-gray-500 text-sm">{emptyMessage}</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.className || ''
                    }`}
                >
                  {column.header}
                </th>
              ))}
              {onRowClick && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item, index) => (
              <tr
                key={index}
                className={`
                  ${onRowClick ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}
                `}
                onClick={() => onRowClick?.(item, index)}
              >
                {columns.map((column, colIndex) => (
                  <td
                    key={colIndex}
                    className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${column.className || ''
                      }`}
                  >
                    {renderCell(item, column, index)}
                  </td>
                ))}
                {onRowClick && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      {mobileCardView && (
        <div className="md:hidden">
          <div className="divide-y divide-gray-200">
            {data.map((item, index) => (
              <div
                key={index}
                className={`
                  p-4 ${onRowClick ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}
                `}
                onClick={() => onRowClick?.(item, index)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    {columns
                      .filter(column => !column.mobileHidden)
                      .slice(0, 3) // Show max 3 columns on mobile
                      .map((column, colIndex) => (
                        <div key={colIndex} className={colIndex > 0 ? 'mt-2' : ''}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                              {column.header}
                            </span>
                            <div className="text-sm text-gray-900 ml-2">
                              {renderCell(item, column, index)}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>

                  {onRowClick && (
                    <div className="ml-4 flex-shrink-0">
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile List View (Alternative) */}
      {!mobileCardView && (
        <div className="md:hidden">
          <div className="divide-y divide-gray-200">
            {data.map((item, index) => (
              <div
                key={index}
                className={`
                  px-4 py-3 flex items-center justify-between
                  ${onRowClick ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}
                `}
                onClick={() => onRowClick?.(item, index)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {renderCell(item, columns[0], index)}
                  </div>
                  {columns[1] && (
                    <div className="text-sm text-gray-500 truncate">
                      {renderCell(item, columns[1], index)}
                    </div>
                  )}
                </div>

                <div className="ml-4 flex items-center space-x-2">
                  {columns.slice(-1).map((column, colIndex) => (
                    <div key={colIndex} className="text-sm text-gray-900">
                      {renderCell(item, column, index)}
                    </div>
                  ))}

                  {onRowClick && (
                    <ChevronRight className="w-4 h-4 text-gray-400 ml-2" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}