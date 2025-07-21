'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  MessageSquare,
  Send,
  Users,
  Eye,
  AlertCircle,
  CheckCircle,
  Loader2,
  FileText,
  Hash
} from 'lucide-react'
import { Template as TemplateType } from '@/lib/api/services/messagesApi'
import { cn } from '@/lib/utils'

interface MessageComposerProps {
  selectedTemplate: TemplateType | null
  selectedLeads: string[]
  templateParams: Record<string, string>
  onTemplateParamsChange: (params: Record<string, string>) => void
  onSendMessage: () => void
  onSendBulkMessage: () => void
  sending?: boolean
  className?: string
}

export function MessageComposer({
  selectedTemplate,
  selectedLeads,
  templateParams,
  onTemplateParamsChange,
  onSendMessage,
  onSendBulkMessage,
  sending = false,
  className
}: MessageComposerProps) {
  const [previewMode, setPreviewMode] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Validate template parameters
  useEffect(() => {
    if (!selectedTemplate) {
      setValidationErrors([])
      return
    }

    const errors: string[] = []
    
    // Check required parameters
    selectedTemplate.parameters.forEach((param, index) => {
      const paramKey = `param_${index + 1}`
      const paramValue = templateParams[paramKey]
      
      if (!paramValue || paramValue.trim() === '') {
        errors.push(`Parameter ${index + 1} is required`)
      } else if (paramValue.length > 100) {
        errors.push(`Parameter ${index + 1} is too long (max 100 characters)`)
      }
    })

    // Check if leads are selected
    if (selectedLeads.length === 0) {
      errors.push('Please select at least one lead')
    }

    setValidationErrors(errors)
  }, [selectedTemplate, templateParams, selectedLeads])

  // Generate message preview
  const getMessagePreview = () => {
    if (!selectedTemplate) return ''
    
    let preview = selectedTemplate.content
    selectedTemplate.parameters.forEach((param, index) => {
      const paramKey = `param_${index + 1}`
      const paramValue = templateParams[paramKey] || `{{${index + 1}}}`
      preview = preview.replace(`{{${index + 1}}}`, paramValue)
    })
    
    return preview
  }

  // Calculate estimated message length
  const getEstimatedLength = () => {
    const preview = getMessagePreview()
    return preview.length
  }

  // Handle parameter change
  const handleParameterChange = (paramKey: string, value: string) => {
    onTemplateParamsChange({
      ...templateParams,
      [paramKey]: value
    })
  }

  // Check if form is valid
  const isFormValid = validationErrors.length === 0 && selectedTemplate && selectedLeads.length > 0

  // Get send button text and action
  const getSendButtonConfig = () => {
    if (selectedLeads.length === 0) {
      return { text: 'Select leads first', action: null, disabled: true }
    } else if (selectedLeads.length === 1) {
      return { 
        text: 'Send to 1 Lead', 
        action: onSendMessage, 
        disabled: !isFormValid || sending,
        icon: Send
      }
    } else {
      return { 
        text: `Send Bulk (${selectedLeads.length} leads)`, 
        action: onSendBulkMessage, 
        disabled: !isFormValid || sending,
        icon: Users
      }
    }
  }

  const sendConfig = getSendButtonConfig()

  if (!selectedTemplate) {
    return (
      <Card className={cn("h-full", className)}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>Compose Message</span>
          </CardTitle>
          <CardDescription>
            Select a template to start composing your message
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No Template Selected</p>
            <p className="text-sm">
              Choose a template from the left panel to start composing your message
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5" />
            <span>Compose Message</span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewMode(!previewMode)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {previewMode ? 'Edit' : 'Preview'}
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          Configure template parameters and send to selected leads
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Template Info */}
        <div className="p-3 bg-muted/50 rounded-lg border" data-testid="selected-template">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-sm">Selected Template</span>
            <Badge variant="outline">
              {selectedTemplate.category}
            </Badge>
          </div>
          <p className="text-sm font-medium mb-1">{selectedTemplate.name}</p>
          <p className="text-xs text-muted-foreground">
            {selectedTemplate.parameters.length} parameter{selectedTemplate.parameters.length !== 1 ? 's' : ''} •
            {selectedTemplate.language.toUpperCase()} •
            {selectedTemplate.templateType}
          </p>
        </div>

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

        <ScrollArea className="h-64">
          {previewMode ? (
            /* Preview Mode */
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Message Preview</Label>
                <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                      <MessageSquare className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-800 mb-1">
                        WhatsApp Business Message
                      </p>
                      <div className="bg-white p-3 rounded-lg shadow-sm border" data-testid="message-preview">
                        <p className="text-sm whitespace-pre-wrap">
                          {getMessagePreview()}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs text-green-600">
                        <span>Estimated length: {getEstimatedLength()} characters</span>
                        <span>Template: {selectedTemplate.name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recipients Preview */}
              <div>
                <Label className="text-sm font-medium">
                  Recipients ({selectedLeads.length})
                </Label>
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    {selectedLeads.length === 1 
                      ? 'This message will be sent to 1 lead'
                      : `This message will be sent to ${selectedLeads.length} leads as a bulk campaign`
                    }
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Edit Mode */
            <div className="space-y-4">
              {/* Template Parameters */}
              {selectedTemplate.parameters.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium flex items-center space-x-2">
                    <Hash className="h-4 w-4" />
                    <span>Template Parameters</span>
                  </Label>
                  {selectedTemplate.parameters.map((param, index) => {
                    const paramKey = `param_${index + 1}`
                    const paramValue = templateParams[paramKey] || ''
                    const hasError = validationErrors.some(error => 
                      error.includes(`Parameter ${index + 1}`)
                    )
                    
                    return (
                      <div key={index} className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Parameter {index + 1} {hasError && <span className="text-red-500">*</span>}
                        </Label>
                        <Input
                          placeholder={`Enter value for {{${index + 1}}}`}
                          value={paramValue}
                          onChange={(e) => handleParameterChange(paramKey, e.target.value)}
                          className={cn(
                            hasError && "border-red-300 focus:border-red-500"
                          )}
                          maxLength={100}
                          data-testid={`param-input-${index + 1}`}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Will replace: {`{{${index + 1}}}`}</span>
                          <span>{paramValue.length}/100</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Template Content Reference */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Template Content</Label>
                <div className="p-3 bg-muted rounded-lg text-sm font-mono">
                  {selectedTemplate.content}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Send Actions */}
        <div className="space-y-3 pt-4 border-t">
          {/* Message Length Warning */}
          {getEstimatedLength() > 1000 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Message is quite long ({getEstimatedLength()} characters). 
                Consider shortening it for better delivery rates.
              </AlertDescription>
            </Alert>
          )}

          {/* Send Button */}
          <Button
            onClick={sendConfig.action || undefined}
            disabled={sendConfig.disabled}
            className="w-full"
            size="lg"
            data-testid={selectedLeads.length === 1 ? "send-message-btn" : "send-bulk-btn"}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : sendConfig.icon ? (
              <sendConfig.icon className="h-4 w-4 mr-2" />
            ) : null}
            {sending ? 'Sending...' : sendConfig.text}
          </Button>

          {/* Success State */}
          {isFormValid && !sending && (
            <div className="flex items-center justify-center space-x-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span>Ready to send</span>
            </div>
          )}

          {/* Bulk Message Warning */}
          {selectedLeads.length > 10 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                You're about to send a bulk message to {selectedLeads.length} leads. 
                This will be processed as a campaign with rate limiting to comply with WhatsApp policies.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
