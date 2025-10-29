'use client';

import React, { useState } from 'react';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { 
  Bold, 
  Italic, 
  List, 
  Link as LinkIcon, 
  Code, 
  Heading1,
  Heading2,
  Eye,
  Edit
} from 'lucide-react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

export function MarkdownEditor({ value, onChange, placeholder, rows = 10 }: MarkdownEditorProps) {
  const [isPreview, setIsPreview] = useState(false);

  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
    
    onChange(newText);
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };

  const toolbarButtons = [
    { icon: Heading1, label: 'Titolo 1', action: () => insertMarkdown('# ', '') },
    { icon: Heading2, label: 'Titolo 2', action: () => insertMarkdown('## ', '') },
    { icon: Bold, label: 'Grassetto', action: () => insertMarkdown('**', '**') },
    { icon: Italic, label: 'Corsivo', action: () => insertMarkdown('*', '*') },
    { icon: List, label: 'Lista', action: () => insertMarkdown('- ', '') },
    { icon: Code, label: 'Codice', action: () => insertMarkdown('`', '`') },
    { icon: LinkIcon, label: 'Link', action: () => insertMarkdown('[', '](url)') },
  ];

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-50 border-b px-3 py-2">
        <div className="flex gap-1">
          {toolbarButtons.map((btn) => (
            <button
              key={btn.label}
              type="button"
              onClick={btn.action}
              className="p-2 hover:bg-gray-200 rounded transition-colors"
              title={btn.label}
            >
              <btn.icon className="h-4 w-4 text-gray-600" />
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsPreview(!isPreview)}
        >
          {isPreview ? (
            <>
              <Edit className="h-4 w-4 mr-2" />
              Modifica
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 mr-2" />
              Anteprima
            </>
          )}
        </Button>
      </div>

      {/* Editor / Preview */}
      {isPreview ? (
        <div className="p-4 prose prose-sm max-w-none min-h-[200px] bg-white">
          <MarkdownRenderer content={value} />
        </div>
      ) : (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="border-0 rounded-none font-mono text-sm resize-none focus:ring-0"
        />
      )}

      {/* Help */}
      <div className="bg-gray-50 border-t px-3 py-2 text-xs text-gray-500">
        <span className="font-semibold">Suggerimenti:</span> **grassetto** | *corsivo* | # Titolo | - Lista | `codice` | [link](url)
      </div>
    </div>
  );
}

// Componente per renderizzare Markdown
export function MarkdownRenderer({ content }: { content: string }) {
  // Semplice parser Markdown (in produzione usa react-markdown o marked)
  const parseMarkdown = (text: string) => {
    let html = text;

    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>');
    
    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
    
    // Code inline
    html = html.replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>');
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:underline">$1</a>');
    
    // Lists
    html = html.replace(/^\- (.+)$/gim, '<li class="ml-4">$1</li>');
    html = html.replace(/(<li.*<\/li>)/s, '<ul class="list-disc my-2">$1</ul>');
    
    // Line breaks
    html = html.replace(/\n/g, '<br />');

    return html;
  };

  return (
    <div 
      className="markdown-content"
      dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }}
    />
  );
}



