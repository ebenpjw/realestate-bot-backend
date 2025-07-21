'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Plus, 
  Trash2, 
  Eye, 
  Send, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  Hash,
  MessageSquare,
  Info
} from 'lucide-react'
import messagesApi from '@/lib/api/services/messagesApi'
import { showErrorToast, showSuccessToast } from '@/lib/utils/errorHandling'
import { cn } from '@/lib/utils'

interface TemplateCreatorProps {
  onTemplateCreated?: (templateId: string) => void
  className?: string
}

export function TemplateCreator({ onTemplateCreated, className }: TemplateCreatorProps) {
  const [templateName, setTemplateName] = useState('')
  const [templateCategory, setTemplateCategory] = useState<'MARKETING' | 'UTILITY' | 'AUTHENTICATION'>('MARKETING')
  const [templateContent, setTemplateContent] = useState('')
  const [parameters, setParameters] = useState<string[]>([])
  const [previewMode, setPreviewMode] = useState(false)
  const [creating, setCreating] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Validate template
  const validateTemplate = () => {
    const errors: string[] = []

    if (!templateName.trim()) {
      errors.push('Template name is required')
    } else if (templateName.length < 3) {
      errors.push('Template name must be at least 3 characters')
    } else if (templateName.length > 50) {
      errors.push('Template name must be less than 50 characters')
    }

    if (!templateContent.trim()) {
      errors.push('Template content is required')
    } else if (templateContent.length < 10) {
      errors.push('Template content must be at least 10 characters')
    } else if (templateContent.length > 1024) {
      errors.push('Template content must be less than 1024 characters')
    }

    // Check for parameter placeholders in content
    const parameterMatches = templateContent.match(/\{\{(\d+)\}\}/g) || []
    const expectedParams = parameterMatches.map(match => parseInt(match.replace(/[{}]/g, '')))
    const uniqueParams = [...new Set(expectedParams)].sort()

    if (uniqueParams.length > 0) {
      // Check if parameters are sequential starting from 1
      for (let i = 0; i < uniqueParams.length; i++) {
        if (uniqueParams[i] !== i + 1) {
          errors.push(`Parameters must be sequential starting from {{1}}. Found {{${uniqueParams[i]}}} but expected {{${i + 1}}}`)
          break
        }
      }

      // Check if we have descriptions for all parameters
      if (parameters.length !== uniqueParams.length) {
        errors.push(`Template has ${uniqueParams.length} parameters but ${parameters.length} descriptions provided`)
      }
    }

    setValidationErrors(errors)
    return errors.length === 0
  }

  // Add parameter
  const addParameter = () => {
    setParameters([...parameters, ''])
  }

  // Remove parameter
  const removeParameter = (index: number) => {
    setParameters(parameters.filter((_, i) => i !== index))
  }

  // Update parameter description
  const updateParameter = (index: number, value: string) => {
    const newParams = [...parameters]
    newParams[index] = value
    setParameters(newParams)
  }

  // Generate preview
  const getPreview = () => {
    let preview = templateContent
    parameters.forEach((param, index) => {
      const placeholder = `{{${index + 1}}}`
      const sampleValue = param || `Sample ${index + 1}`
      preview = preview.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), sampleValue)
    })
    return preview
  }

  // Create template
  const handleCreateTemplate = async () => {
    if (!validateTemplate()) {
      return
    }

    try {
      setCreating(true)

      const result = await messagesApi.createTemplate({
        templateName: templateName.trim(),
        templateCategory,
        templateContent: templateContent.trim(),
        templateParams: parameters.filter(p => p.trim()),
        languageCode: 'en',
        templateType: 'TEXT'
      })

      showSuccessToast('Template created successfully! It will be available after approval.')
      
      // Reset form
      setTemplateName('')
      setTemplateContent('')
      setParameters([])
      setValidationErrors([])
      setPreviewMode(false)

      if (onTemplateCreated) {
        onTemplateCreated(result.templateId)
      }

    } catch (error: any) {
      console.error('Error creating template:', error)
      showErrorToast(error.response?.data?.error || 'Failed to create template')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Plus className="h-5 w-5" />
          <span>Create New Template</span>
        </CardTitle>
        <CardDescription>
          Create a new WhatsApp Business template for messaging campaigns
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Template Guidelines */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Template Guidelines:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Templates must be approved by WhatsApp before use</li>
              <li>Use parameters like {'{1}'}, {'{2}'} for dynamic content</li>
              <li>Marketing templates require opt-in from recipients</li>
              <li>Keep content professional and compliant</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index} className="text-sm">{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Template Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">Template Name *</Label>
              <Input
                id="templateName"
                placeholder="e.g., Welcome Message, Property Update"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                maxLength={50}
                data-testid="template-name-input"
              />
              <p className="text-xs text-muted-foreground">
                {templateName.length}/50 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="templateCategory">Category *</Label>
              <Select value={templateCategory} onValueChange={(value: any) => setTemplateCategory(value)}>
                <SelectTrigger data-testid="template-category-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="UTILITY">Utility</SelectItem>
                  <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="templateContent">Template Content *</Label>
              <Textarea
                id="templateContent"
                placeholder="Enter your template content here. Use {{1}}, {{2}} for parameters."
                value={templateContent}
                onChange={(e) => setTemplateContent(e.target.value)}
                rows={6}
                maxLength={1024}
                data-testid="template-content-textarea"
              />
              <p className="text-xs text-muted-foreground">
                {templateContent.length}/1024 characters
              </p>
            </div>

            {/* Parameters */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center space-x-2">
                  <Hash className="h-4 w-4" />
                  <span>Parameters</span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addParameter}
                  data-testid="add-parameter-btn"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Parameter
                </Button>
              </div>

              {parameters.map((param, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Badge variant="outline" className="min-w-12 justify-center">
                    {`{{${index + 1}}}`}
                  </Badge>
                  <Input
                    placeholder={`Description for parameter ${index + 1}`}
                    value={param}
                    onChange={(e) => updateParameter(index, e.target.value)}
                    className="flex-1"
                    data-testid={`parameter-input-${index}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeParameter(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {parameters.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No parameters defined. Add parameters to make your template dynamic.
                </p>
              )}
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Template Preview</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreviewMode(!previewMode)}
              >
                <Eye className="h-4 w-4 mr-2" />
                {previewMode ? 'Show Raw' : 'Show Preview'}
              </Button>
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded-lg min-h-48">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800 mb-2">
                    WhatsApp Business Message Preview
                  </p>
                  <div className="bg-white p-3 rounded-lg shadow-sm border">
                    {templateContent ? (
                      <p className="text-sm whitespace-pre-wrap">
                        {previewMode ? getPreview() : templateContent}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        Enter template content to see preview
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-green-600">
                    <Badge variant="outline" className="text-xs">
                      {templateCategory}
                    </Badge>
                    <span>{templateContent.length} characters</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Parameter Descriptions */}
            {parameters.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">Parameter Descriptions</Label>
                <div className="space-y-1">
                  {parameters.map((param, index) => (
                    <div key={index} className="flex items-center space-x-2 text-xs">
                      <Badge variant="secondary" className="min-w-12 justify-center">
                        {`{{${index + 1}}}`}
                      </Badge>
                      <span className="text-muted-foreground">
                        {param || `Parameter ${index + 1}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={handleCreateTemplate}
            disabled={creating || validationErrors.length > 0}
            size="lg"
            data-testid="create-template-btn"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {creating ? 'Creating Template...' : 'Create Template'}
          </Button>
        </div>

        {/* Success State */}
        {!creating && validationErrors.length === 0 && templateName && templateContent && (
          <div className="flex items-center justify-center space-x-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span>Template is ready to create</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
