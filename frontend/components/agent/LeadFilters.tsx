'use client'

interface LeadFiltersProps {
  statusFilter: string
  onStatusFilterChange: (status: string) => void
  intentFilter: string
  onIntentFilterChange: (intent: string) => void
  sourceFilter: string
  onSourceFilterChange: (source: string) => void
  dateRange: string
  onDateRangeChange: (range: string) => void
}

export function LeadFilters({
  statusFilter,
  onStatusFilterChange,
  intentFilter,
  onIntentFilterChange,
  sourceFilter,
  onSourceFilterChange,
  dateRange,
  onDateRangeChange,
}: LeadFiltersProps) {
  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'new', label: 'New' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'booked', label: 'Booked' },
    { value: 'completed', label: 'Completed' },
    { value: 'lost', label: 'Lost' },
  ]

  const intentOptions = [
    { value: 'all', label: 'All Intent' },
    { value: 'buy', label: 'Buy' },
    { value: 'rent', label: 'Rent' },
    { value: 'browse', label: 'Browse' },
    { value: 'invest', label: 'Invest' },
  ]

  const sourceOptions = [
    { value: 'all', label: 'All Sources' },
    { value: 'Facebook Lead Ad', label: 'Facebook Lead Ad' },
    { value: 'WhatsApp Direct', label: 'WhatsApp Direct' },
    { value: 'Property Portal', label: 'Property Portal' },
    { value: 'Referral', label: 'Referral' },
    { value: 'Website', label: 'Website' },
  ]

  const dateRangeOptions = [
    { value: 'all', label: 'All Time' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
  ]

  return (
    <div className="border-t border-gray-200 pt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="input-field"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Intent Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Intent
          </label>
          <select
            value={intentFilter}
            onChange={(e) => onIntentFilterChange(e.target.value)}
            className="input-field"
          >
            {intentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Source Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Source
          </label>
          <select
            value={sourceFilter}
            onChange={(e) => onSourceFilterChange(e.target.value)}
            className="input-field"
          >
            {sourceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date Range
          </label>
          <select
            value={dateRange}
            onChange={(e) => onDateRangeChange(e.target.value)}
            className="input-field"
          >
            {dateRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Filters Display */}
      <div className="mt-4 flex flex-wrap gap-2">
        {statusFilter !== 'all' && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Status: {statusOptions.find(o => o.value === statusFilter)?.label}
            <button
              onClick={() => onStatusFilterChange('all')}
              className="ml-2 text-blue-600 hover:text-blue-800"
            >
              ×
            </button>
          </span>
        )}
        
        {intentFilter !== 'all' && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Intent: {intentOptions.find(o => o.value === intentFilter)?.label}
            <button
              onClick={() => onIntentFilterChange('all')}
              className="ml-2 text-green-600 hover:text-green-800"
            >
              ×
            </button>
          </span>
        )}
        
        {sourceFilter !== 'all' && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            Source: {sourceOptions.find(o => o.value === sourceFilter)?.label}
            <button
              onClick={() => onSourceFilterChange('all')}
              className="ml-2 text-purple-600 hover:text-purple-800"
            >
              ×
            </button>
          </span>
        )}
        
        {dateRange !== 'all' && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            Date: {dateRangeOptions.find(o => o.value === dateRange)?.label}
            <button
              onClick={() => onDateRangeChange('all')}
              className="ml-2 text-orange-600 hover:text-orange-800"
            >
              ×
            </button>
          </span>
        )}
        
        {(statusFilter !== 'all' || intentFilter !== 'all' || sourceFilter !== 'all' || dateRange !== 'all') && (
          <button
            onClick={() => {
              onStatusFilterChange('all')
              onIntentFilterChange('all')
              onSourceFilterChange('all')
              onDateRangeChange('all')
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear all filters
          </button>
        )}
      </div>
    </div>
  )
}
