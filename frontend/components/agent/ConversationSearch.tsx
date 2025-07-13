'use client'

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

interface ConversationSearchProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  statusFilter: string
  onStatusFilterChange: (status: string) => void
}

export function ConversationSearch({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: ConversationSearchProps) {
  const statusOptions = [
    { value: 'all', label: 'All Status', count: 0 },
    { value: 'new', label: 'New', count: 0 },
    { value: 'qualified', label: 'Qualified', count: 0 },
    { value: 'booked', label: 'Booked', count: 0 },
    { value: 'lost', label: 'Lost', count: 0 },
  ]

  return (
    <div className="space-y-3 mb-4">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-1">
        {statusOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onStatusFilterChange(option.value)}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              statusFilter === option.value
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
