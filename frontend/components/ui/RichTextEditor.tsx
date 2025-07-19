'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from './button'
import { Card } from './card'
import { 
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  Link, 
  Image,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react'

interface RichTextEditorProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export default function RichTextEditor({
  value = '',
  onChange,
  placeholder = 'Start typing...',
  className = '',
  disabled = false
}: RichTextEditorProps) {
  const [content, setContent] = useState(value)
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setContent(value)
  }, [value])

  const handleContentChange = () => {
    if (editorRef.current) {
      const newContent = editorRef.current.innerHTML
      setContent(newContent)
      onChange?.(newContent)
    }
  }

  const executeCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    handleContentChange()
  }

  const insertLink = () => {
    const url = prompt('Enter URL:')
    if (url) {
      executeCommand('createLink', url)
    }
  }

  const insertImage = () => {
    const url = prompt('Enter image URL:')
    if (url) {
      executeCommand('insertImage', url)
    }
  }

  const toolbarButtons = [
    { icon: Bold, command: 'bold', title: 'Bold' },
    { icon: Italic, command: 'italic', title: 'Italic' },
    { icon: Underline, command: 'underline', title: 'Underline' },
    { icon: List, command: 'insertUnorderedList', title: 'Bullet List' },
    { icon: ListOrdered, command: 'insertOrderedList', title: 'Numbered List' },
    { icon: AlignLeft, command: 'justifyLeft', title: 'Align Left' },
    { icon: AlignCenter, command: 'justifyCenter', title: 'Align Center' },
    { icon: AlignRight, command: 'justifyRight', title: 'Align Right' },
  ]

  return (
    <Card className={`border rounded-lg ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b bg-gray-50">
        {toolbarButtons.map(({ icon: Icon, command, title }) => (
          <Button
            key={command}
            variant="ghost"
            size="sm"
            onClick={() => executeCommand(command)}
            disabled={disabled}
            title={title}
            className="h-8 w-8 p-0"
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
        
        <div className="w-px h-6 bg-gray-300 mx-1" />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={insertLink}
          disabled={disabled}
          title="Insert Link"
          className="h-8 w-8 p-0"
        >
          <Link className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={insertImage}
          disabled={disabled}
          title="Insert Image"
          className="h-8 w-8 p-0"
        >
          <Image className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        className={`min-h-[200px] p-4 outline-none ${
          disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
        }`}
        onInput={handleContentChange}
        dangerouslySetInnerHTML={{ __html: content }}
        style={{ 
          wordBreak: 'break-word',
          overflowWrap: 'break-word'
        }}
        data-placeholder={placeholder}
      />

      <style jsx>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
      `}</style>
    </Card>
  )
}

export { RichTextEditor }
