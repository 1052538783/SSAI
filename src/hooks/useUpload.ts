/**
 * useUpload — 文件上传 Hook
 * 封装拖拽/点击上传逻辑
 */

import { useCallback, useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { fileToBase64 } from '../services/imageUtils';
import { MAX_UPLOAD_IMAGES } from '../config/models';
import { v4 as uuidv4 } from 'uuid';

export function useUpload(showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void) {
  const { uploadedImages, addUploadedImage } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_UPLOAD_IMAGES - uploadedImages.length;
    if (remaining <= 0) {
      showToast?.(`最多上传${MAX_UPLOAD_IMAGES}张参考图`, 'error');
      return;
    }

    const validFiles = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, remaining);

    for (const file of validFiles) {
      try {
        const base64 = await fileToBase64(file);
        addUploadedImage({
          id: uuidv4(),
          base64,
          mimeType: file.type,
          filename: file.name,
        });
      } catch {
        showToast?.('图片读取失败', 'error');
      }
    }

    if (validFiles.length > 0) {
      showToast?.(`已添加 ${validFiles.length} 张参考图`, 'success');
    }
  }, [uploadedImages.length, addUploadedImage, showToast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return {
    fileInputRef,
    openFilePicker,
    handleFiles,
    handleDrop,
    fileCount: uploadedImages.length,
    maxFiles: MAX_UPLOAD_IMAGES,
  };
}
