'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from './button'
import { Input } from './input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { Textarea } from './textarea'
import { LoadingSpinner } from './LoadingSpinner'
import { Check, X, Edit2, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EditableFieldProps {
  value: string | undefined
  onSave: (value: string) => Promise<void>
  type?: 'text' | 'select' | 'textarea' | 'number' | 'date'
  options?: { value: string; label: string }[]
  placeholder?: string
  className?: string
  displayClassName?: string
  validation?: (value: string) => string | null
  formatDisplay?: (value: string) => string
  disabled?: boolean
  multiline?: boolean
}

export function EditableField({
  value,
  onSave,
  type = 'text',
  options = [],
  placeholder = 'Click to edit',
  className,
  displayClassName,
  validation,
  formatDisplay,
  disabled = false,
  multiline = false
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    setEditValue(value || '')
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      if (type === 'text' || type === 'textarea') {
        inputRef.current.select()
      }
    }
  }, [isEditing, type])

  const handleEdit = () => {
    if (disabled) return
    setIsEditing(true)
    setError(null)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditValue(value || '')
    setError(null)
  }

  const handleSave = async () => {
    if (validation) {
      const validationError = validation(editValue)
      if (validationError) {
        setError(validationError)
        return
      }
    }

    setIsLoading(true)
    setError(null)

    try {
      await onSave(editValue)
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  const displayValue = value ? (formatDisplay ? formatDisplay(value) : value) : placeholder

  if (isEditing) {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center space-x-2">
          {type === 'select' ? (
            <Select value={editValue} onValueChange={setEditValue}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : type === 'textarea' || multiline ? (
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="flex-1 min-h-[80px]"
              disabled={isLoading}
            />
          ) : (
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={type}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="flex-1"
              disabled={isLoading}
            />
          )}
          
          <div className="flex items-center space-x-1">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isLoading}
              className="h-8 w-8 p-0"
            >
              {isLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group flex items-center space-x-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 transition-colors',
        disabled && 'cursor-not-allowed opacity-50',
        displayClassName
      )}
      onClick={handleEdit}
    >
      <span className={cn(
        'flex-1',
        !value && 'text-muted-foreground italic'
      )}>
        {displayValue}
      </span>
      {!disabled && (
        <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  )
}
