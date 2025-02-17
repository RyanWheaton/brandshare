import React from 'react';
import { Card } from "@/components/ui/card";
import { FileObject } from "@shared/schema";
import { ImageIcon, Film, FileText } from "lucide-react";

type PageThumbnailProps = {
  title: string;
  description?: string | null;
  files: FileObject[];
  backgroundColor: string;
  backgroundColorSecondary?: string | null;
  textColor: string;
  titleFont: string;
  descriptionFont: string;
  titleFontSize?: number;
  descriptionFontSize?: number;
  className?: string;
  style?: React.CSSProperties;
};

function FilePreviewThumb({ file, style }: { file: FileObject; style?: React.CSSProperties }) {
  const fileType = file.name.split('.').pop()?.toLowerCase();
  const isImage = fileType ? ['jpg', 'jpeg', 'png', 'gif'].includes(fileType) : false;
  const isVideo = fileType ? ['mp4', 'mov'].includes(fileType) : false;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 p-1 bg-muted/50 rounded text-[8px]">
        {isImage && <ImageIcon className="w-2 h-2" />}
        {isVideo && <Film className="w-2 h-2" />}
        {!isImage && !isVideo && <FileText className="w-2 h-2" />}
        <span className="truncate" style={{ fontFamily: style?.['--title-font'] }}>
          {file.title || file.name}
        </span>
      </div>
      {file.description && (
        <p 
          className="text-[6px] px-1 opacity-75 truncate"
          style={{ fontFamily: style?.['--description-font'] }}
        >
          {file.description}
        </p>
      )}
    </div>
  );
}

export function PageThumbnail({
  title,
  description,
  files,
  backgroundColor,
  backgroundColorSecondary,
  textColor,
  titleFont,
  descriptionFont,
  titleFontSize = 24,
  descriptionFontSize = 16,
  className = "",
  style = {},
}: PageThumbnailProps) {
  const combinedStyle = {
    backgroundColor: backgroundColor || "#ffffff",
    background: backgroundColorSecondary
      ? `linear-gradient(to bottom, ${backgroundColor || "#ffffff"}, ${backgroundColorSecondary})`
      : backgroundColor || "#ffffff",
    color: textColor || "#000000",
    '--title-font': titleFont || "Inter",
    '--description-font': descriptionFont || "Inter",
    ...style,
  } as React.CSSProperties;

  return (
    <div
      className={`w-full aspect-[4/3] rounded-lg shadow-sm overflow-hidden border ${className}`}
      style={combinedStyle}
    >
      <div className="p-2 w-full h-full flex flex-col">
        <div className="text-center mb-2">
          <h3
            className="font-bold mb-1 truncate"
            style={{
              fontSize: `${titleFontSize / 8}px`,
              fontFamily: combinedStyle['--title-font'],
            }}
          >
            {title}
          </h3>
          {description && (
            <p
              className="opacity-90 truncate"
              style={{
                fontSize: `${descriptionFontSize / 8}px`,
                fontFamily: combinedStyle['--description-font'],
              }}
            >
              {description}
            </p>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="grid gap-1">
            {files.slice(0, 3).map((file, index) => (
              <FilePreviewThumb key={index} file={file} style={combinedStyle} />
            ))}
            {files.length > 3 && (
              <div 
                className="text-[8px] text-center text-muted-foreground"
                style={{ fontFamily: combinedStyle['--description-font'] }}
              >
                +{files.length - 3} more files
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}