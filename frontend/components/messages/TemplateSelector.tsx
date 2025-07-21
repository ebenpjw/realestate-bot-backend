'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, FileText, Eye, Filter, RefreshCw } from 'lucide-react'
import { Template as TemplateType } from '@/lib/api/services/messagesApi'
import { cn } from '@/lib/utils'

interface TemplateSelectorProps {
  templates: TemplateType[]
  selectedTemplate: TemplateType | null
  onTemplateSelect: (template: TemplateType) => void
  loading?: boolean
  onRefresh?: () => void
  className?: string
}

export function TemplateSelector({
  templates,
  selectedTemplate,
  onTemplateSelect,
  loading = false,
  onRefresh,
  className
}: TemplateSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [previewTemplate, setPreviewTemplate] = useState<TemplateType | null>(null)

  // Filter templates based on search and category
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         template.content.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  // Get unique categories from templates
  const categories = Array.from(new Set(templates.map(t => t.category)))

  // Get category color
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'MARKETING':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'UTILITY':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'AUTHENTICATION':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Highlight template parameters in content
  const highlightParameters = (content: string) => {
    return content.replace(/\{\{(\d+)\}\}/g, '<span class="bg-yellow-100 text-yellow-800 px-1 rounded font-medium">{{$1}}</span>')
  }

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Select Template</span>
            </CardTitle>
            <CardDescription>
              Choose from your approved WhatsApp templates ({filteredTemplates.length} available)
            </CardDescription>
          </div>
          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search and Filter Controls */}
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Templates List */}
        <ScrollArea className="h-96">
          <div className="space-y-2" data-testid="templates-grid">
            {loading ? (
              // Loading skeletons
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-3 w-full mb-1" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ))
            ) : filteredTemplates.length === 0 ? (
              // Empty state
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No templates found</p>
                <p className="text-sm">
                  {searchTerm || categoryFilter !== 'all' 
                    ? 'Try adjusting your search or filter criteria'
                    : 'No approved templates available'
                  }
                </p>
              </div>
            ) : (
              // Templates list
              filteredTemplates.map((template, index) => (
                <div
                  key={template.id}
                  className={cn(
                    "p-3 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md",
                    selectedTemplate?.id === template.id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50'
                  )}
                  onClick={() => onTemplateSelect(template)}
                  data-testid={`template-card-${index}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm truncate flex-1 mr-2">
                      {template.name}
                    </span>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", getCategoryColor(template.category))}
                      >
                        {template.category}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPreviewTemplate(template)
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground mb-2">
                    <div 
                      className="line-clamp-2"
                      dangerouslySetInnerHTML={{ 
                        __html: highlightParameters(template.content) 
                      }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {template.parameters.length} parameter{template.parameters.length !== 1 ? 's' : ''}
                    </span>
                    <span>{template.language.toUpperCase()}</span>
                  </div>
                  
                  {template.buttonSupported && (
                    <div className="mt-2">
                      <Badge variant="secondary" className="text-xs">
                        Buttons: {template.buttonSupported}
                      </Badge>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Selected Template Summary */}
        {selectedTemplate && (
          <div className="p-3 bg-muted/50 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">Selected Template</span>
              <Badge className={getCategoryColor(selectedTemplate.category)}>
                {selectedTemplate.category}
              </Badge>
            </div>
            <p className="text-sm font-medium mb-1">{selectedTemplate.name}</p>
            <p className="text-xs text-muted-foreground">
              {selectedTemplate.parameters.length} parameter{selectedTemplate.parameters.length !== 1 ? 's' : ''} required
            </p>
          </div>
        )}
      </CardContent>

      {/* Template Preview Modal/Overlay - Simple implementation */}
      {previewTemplate && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setPreviewTemplate(null)}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-96 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Template Preview</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewTemplate(null)}
              >
                ×
              </Button>
            </div>
            
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">{previewTemplate.name}</p>
                <Badge className={getCategoryColor(previewTemplate.category)}>
                  {previewTemplate.category}
                </Badge>
              </div>
              
              <div>
                <p className="text-sm font-medium mb-2">Content:</p>
                <div 
                  className="text-sm p-3 bg-gray-50 rounded border whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ 
                    __html: highlightParameters(previewTemplate.content) 
                  }}
                />
              </div>
              
              {previewTemplate.parameters.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Parameters:</p>
                  <div className="space-y-1">
                    {previewTemplate.parameters.map((param, index) => (
                      <div key={index} className="text-xs bg-yellow-50 px-2 py-1 rounded">
                        {`{{${index + 1}}}`} - Parameter {index + 1}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="text-xs text-muted-foreground pt-2 border-t">
                <p>Language: {previewTemplate.language.toUpperCase()}</p>
                <p>Type: {previewTemplate.templateType}</p>
                <p>Status: {previewTemplate.status}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
