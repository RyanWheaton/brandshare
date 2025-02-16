import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { Button } from './button';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Undo,
  Redo,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TipTapEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function TipTapEditor({ value, onChange, className }: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  const toggleLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) {
      return;
    }

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className={cn("rounded-md border", className)}>
      <div className="flex flex-wrap gap-1 p-1 border-b bg-muted/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('bold') && "bg-muted")}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('italic') && "bg-muted")}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('strike') && "bg-muted")}
        >
          <Underline className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLink}
          className={cn("h-8 w-8 p-0", editor.isActive('link') && "bg-muted")}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <div className="w-px h-8 bg-border mx-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: 'left' }) && "bg-muted")}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: 'center' }) && "bg-muted")}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: 'right' }) && "bg-muted")}
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <div className="w-px h-8 bg-border mx-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-8 w-8 p-0"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="h-8 w-8 p-0"
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>
      <EditorContent 
        editor={editor} 
        className="prose prose-sm max-w-none p-4 focus:outline-none" 
      />
    </div>
  );
}
