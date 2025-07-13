'use client'

import { Menu, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import {
  ChevronDownIcon,
  XMarkIcon,
  TrashIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface BulkActionsProps {
  selectedCount: number
  onStatusUpdate: (status: string) => void
  onDelete: () => void
  onClearSelection: () => void
}

export function BulkActions({
  selectedCount,
  onStatusUpdate,
  onDelete,
  onClearSelection,
}: BulkActionsProps) {
  const statusOptions = [
    { value: 'new', label: 'Mark as New', color: 'text-blue-600' },
    { value: 'qualified', label: 'Mark as Qualified', color: 'text-green-600' },
    { value: 'booked', label: 'Mark as Booked', color: 'text-purple-600' },
    { value: 'completed', label: 'Mark as Completed', color: 'text-emerald-600' },
    { value: 'lost', label: 'Mark as Lost', color: 'text-red-600' },
  ]

  return (
    <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <span className="text-sm font-medium text-primary-900">
              {selectedCount} lead{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={onClearSelection}
              className="ml-2 text-primary-600 hover:text-primary-800"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {/* Status Update Dropdown */}
            <Menu as="div" className="relative">
              <Menu.Button className="btn-secondary flex items-center">
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Update Status
                <ChevronDownIcon className="h-4 w-4 ml-2" />
              </Menu.Button>

              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute left-0 z-10 mt-2 w-48 origin-top-left rounded-lg bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  {statusOptions.map((option) => (
                    <Menu.Item key={option.value}>
                      {({ active }) => (
                        <button
                          onClick={() => onStatusUpdate(option.value)}
                          className={clsx(
                            active ? 'bg-gray-100' : '',
                            'block w-full px-4 py-2 text-left text-sm',
                            option.color
                          )}
                        >
                          {option.label}
                        </button>
                      )}
                    </Menu.Item>
                  ))}
                </Menu.Items>
              </Transition>
            </Menu>

            {/* Delete Button */}
            <button
              onClick={onDelete}
              className="btn-secondary text-red-600 hover:text-red-800 hover:bg-red-50 flex items-center"
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete
            </button>
          </div>
        </div>

        <div className="text-xs text-primary-600">
          Bulk actions will be applied to all selected leads
        </div>
      </div>
    </div>
  )
}
