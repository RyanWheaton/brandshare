import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FileText, Image as ImageIcon, Film, GripVertical, Trash2 } from "lucide-react";
import { Card, CardContent } from "./card";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import type { FileObject } from "@shared/schema";

interface SortableFileProps {
  id: number;
  file: FileObject;
  onRemove?: () => void;
}

function SortableFile({ id, file, onRemove }: SortableFileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const fileType = file.name.split('.').pop()?.toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(fileType || '');
  const isVideo = ['mp4', 'mov'].includes(fileType || '');

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "touch-none",
        isDragging && "opacity-50"
      )}
    >
      <Card className="mb-2">
        <CardContent className="p-3 flex items-center gap-3">
          <button
            className="cursor-grab active:cursor-grabbing" 
            {...attributes} 
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>

          {isImage && <ImageIcon className="h-4 w-4" />}
          {isVideo && <Film className="h-4 w-4" />}
          {!isImage && !isVideo && <FileText className="h-4 w-4" />}

          <span className="text-sm truncate flex-1">{file.name}</span>

          {onRemove && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Remove file</span>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface SortableFilesProps {
  files: FileObject[];
  onReorder: (newFiles: FileObject[]) => void;
  onRemove?: (index: number) => void;
}

export function SortableFiles({ files, onReorder, onRemove }: SortableFilesProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = files.findIndex((_, i) => i === active.id);
      const newIndex = files.findIndex((_, i) => i === over.id);
      onReorder(arrayMove(files, oldIndex, newIndex));
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={files.map((_, i) => i)}
        strategy={verticalListSortingStrategy}
      >
        {files.map((file, index) => (
          <SortableFile 
            key={index} 
            id={index} 
            file={file}
            onRemove={onRemove ? () => onRemove(index) : undefined}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}