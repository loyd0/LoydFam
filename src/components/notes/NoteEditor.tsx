"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { Bold, Italic, Heading2, List, ListOrdered, Link as LinkIcon, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

interface NoteEditorValue {
  markdown: string;
  tiptapJson: unknown;
}

interface NoteEditorProps {
  initialMarkdown?: string;
  initialTiptap?: unknown;
  onChange: (value: NoteEditorValue) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

function htmlToMarkdown(html: string): string {
  // Minimal HTML-to-markdown converter for the subset we emit from StarterKit.
  return html
    .replace(/<p><\/p>/g, "\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<strong>(.*?)<\/strong>/g, "**$1**")
    .replace(/<b>(.*?)<\/b>/g, "**$1**")
    .replace(/<em>(.*?)<\/em>/g, "_$1_")
    .replace(/<i>(.*?)<\/i>/g, "_$1_")
    .replace(/<code>(.*?)<\/code>/g, "`$1`")
    .replace(/<h1>(.*?)<\/h1>/g, "# $1\n")
    .replace(/<h2>(.*?)<\/h2>/g, "## $1\n")
    .replace(/<h3>(.*?)<\/h3>/g, "### $1\n")
    .replace(/<blockquote><p>(.*?)<\/p><\/blockquote>/g, "> $1\n")
    .replace(/<ul>([\s\S]*?)<\/ul>/g, (_, inner: string) =>
      inner.replace(/<li><p>(.*?)<\/p><\/li>/g, "- $1\n"),
    )
    .replace(/<ol>([\s\S]*?)<\/ol>/g, (_, inner: string) => {
      let i = 0;
      return inner.replace(/<li><p>(.*?)<\/p><\/li>/g, (_m, content: string) => `${++i}. ${content}\n`);
    })
    .replace(/<a href="([^"]+)"[^>]*>(.*?)<\/a>/g, "[$2]($1)")
    .replace(/<p>(.*?)<\/p>/g, "$1\n\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export function NoteEditor({
  initialMarkdown,
  initialTiptap,
  onChange,
  placeholder = "Write a note…",
  autoFocus,
}: NoteEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({ placeholder }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2",
        },
      }),
    ],
    content:
      initialTiptap && typeof initialTiptap === "object"
        ? (initialTiptap as never)
        : initialMarkdown && initialMarkdown.trim().length > 0
        ? initialMarkdown
        : "",
    autofocus: autoFocus,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[120px] rounded-md border border-input bg-transparent px-3 py-2 shadow-xs focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange({
        markdown: htmlToMarkdown(html),
        tiptapJson: editor.getJSON(),
      });
    },
  });

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  if (!editor) {
    return (
      <div className="min-h-[120px] rounded-md border border-input bg-muted/20 animate-pulse" />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 rounded-md border border-input bg-muted/20 p-1">
        <ToolbarBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          icon={<Bold className="h-3.5 w-3.5" />}
          label="Bold"
        />
        <ToolbarBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          icon={<Italic className="h-3.5 w-3.5" />}
          label="Italic"
        />
        <ToolbarBtn
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          icon={<Heading2 className="h-3.5 w-3.5" />}
          label="Heading"
        />
        <ToolbarBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          icon={<List className="h-3.5 w-3.5" />}
          label="Bullets"
        />
        <ToolbarBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          icon={<ListOrdered className="h-3.5 w-3.5" />}
          label="Numbered"
        />
        <ToolbarBtn
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          icon={<Quote className="h-3.5 w-3.5" />}
          label="Quote"
        />
        <ToolbarBtn
          active={editor.isActive("link")}
          onClick={() => {
            const prev = editor.getAttributes("link").href as string | undefined;
            const url = window.prompt("Link URL", prev ?? "");
            if (url === null) return;
            if (url === "") {
              editor.chain().focus().unsetLink().run();
              return;
            }
            editor.chain().focus().setLink({ href: url }).run();
          }}
          icon={<LinkIcon className="h-3.5 w-3.5" />}
          label="Link"
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn("h-7 w-7", active && "bg-accent text-accent-foreground")}
    >
      {icon}
    </Button>
  );
}
