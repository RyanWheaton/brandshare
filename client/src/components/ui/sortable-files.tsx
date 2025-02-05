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
import { FileText, Image as ImageIcon, Film, GripVertical } from "lucide-react";
import { Card, CardContent } from "./card";
import { cn } from "@/lib/utils";

interface SortableFileProps {
  id: number;
  file: any;
}

function SortableFile({ id, file }: SortableFileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const fileType = file.name.split('.').pop()?.toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(fileType);
  const isVideo = ['mp4', 'mov'].includes(fileType);

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
          
          <span className="text-sm truncate">{file.name}</span>
        </CardContent>
      </Card>
    </div>
  );
}

interface SortableFilesProps {
  files: any[];
  onReorder: (newFiles: any[]) => void;
}

export function SortableFiles({ files, onReorder }: SortableFilesProps) {
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
          <SortableFile key={index} id={index} file={file} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
