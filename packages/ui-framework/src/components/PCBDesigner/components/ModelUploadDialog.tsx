/**
 * Model Upload Dialog Component
 * Phase 16: 3D Component Models
 *
 * Provides UI for uploading 3D model files (STL, OBJ).
 * Supports drag-and-drop and file picker.
 */

import React, { useState, useRef, useCallback } from 'react';
import { Model3D } from '../types3d';
import { STLLoader } from '../loaders/STLLoader';
import { OBJLoader } from '../loaders/OBJLoader';
import { ModelCache } from '../storage/ModelCache';
import styles from './ModelUploadDialog.module.css';

interface ModelUploadDialogProps {
  /** Callback when model is successfully uploaded */
  onUpload: (model: Model3D) => void;

  /** Callback when dialog is closed */
  onClose: () => void;

  /** Maximum file size in MB (default: 50) */
  maxSizeMB?: number;

  /** Show dialog */
  isOpen: boolean;
}

/**
 * Dialog component for uploading 3D models
 */
export function ModelUploadDialog({
  onUpload,
  onClose,
  maxSizeMB = 50,
  isOpen,
}: ModelUploadDialogProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback(
    async (file: File) => {
      setError(null);
      setProgress(0);

      // Validate file
      if (!file) {
        setError('No file selected');
        return;
      }

      if (!['stl', 'obj'].some((ext) => file.name.toLowerCase().endsWith(ext))) {
        setError('Invalid file format. Only STL and OBJ files are supported.');
        return;
      }

      if (file.size > maxSizeBytes) {
        setError(`File is too large. Maximum size is ${maxSizeMB}MB.`);
        return;
      }

      setSelectedFile(file);
      setProgress(50);

      try {
        setIsLoading(true);

        // Load file
        const arrayBuffer = await file.arrayBuffer();
        setProgress(60);

        // Parse model
        let loader: STLLoader | OBJLoader;
        if (file.name.toLowerCase().endsWith('.stl')) {
          loader = new STLLoader();
        } else {
          loader = new OBJLoader();
        }

        const result = await loader.parse(arrayBuffer, file.name);
        setProgress(80);

        // Store in cache
        await ModelCache.store(result.model);
        setProgress(100);

        // Notify parent
        onUpload(result.model);

        // Reset state
        setTimeout(() => {
          setSelectedFile(null);
          setProgress(0);
          onClose();
        }, 500);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to process model file';
        setError(errorMessage);
        setProgress(0);
      } finally {
        setIsLoading(false);
      }
    },
    [maxSizeBytes, maxSizeMB, onUpload, onClose]
  );

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  /**
   * Handle drag leave
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  /**
   * Handle drop
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  /**
   * Handle file input change
   */
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.currentTarget.files;
      if (files && files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  /**
   * Open file picker
   */
  const handlePickFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Get remaining storage
   */
  const [remainingStorage, setRemainingStorage] = useState<number | null>(null);

  React.useEffect(() => {
    const checkStorage = async () => {
      const remaining = await ModelCache.getRemainingStorage();
      setRemainingStorage(remaining);
    };
    checkStorage();
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Upload 3D Model</h2>
          <button
            className={styles.closeButton}
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className={styles.content}>
          {!selectedFile ? (
            <>
              {/* Drag and drop area */}
              <div
                className={`${styles.dropZone} ${isDragOver ? styles.dragOver : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className={styles.dropZoneContent}>
                  <svg
                    className={styles.uploadIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p className={styles.dropText}>
                    Drag and drop your model here
                  </p>
                  <p className={styles.dropSubtext}>or click to browse</p>
                </div>
              </div>

              {/* File picker button */}
              <button
                className={styles.pickButton}
                onClick={handlePickFile}
                disabled={isLoading}
              >
                Browse Files
              </button>

              {/* File input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".stl,.obj"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
                disabled={isLoading}
              />

              {/* File format info */}
              <div className={styles.infoBox}>
                <h3>Supported Formats</h3>
                <ul>
                  <li>
                    <strong>STL</strong> - Stereolithography (binary and ASCII)
                  </li>
                  <li>
                    <strong>OBJ</strong> - Wavefront OBJ format
                  </li>
                </ul>
              </div>

              {/* Storage info */}
              <div className={styles.storageInfo}>
                <p>
                  <strong>Max file size:</strong> {maxSizeMB}MB
                </p>
                {remainingStorage !== null && (
                  <p>
                    <strong>Storage available:</strong>{' '}
                    {(remainingStorage / 1024 / 1024).toFixed(1)}MB
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Loading state */}
              <div className={styles.loadingState}>
                <div className={styles.fileInfo}>
                  <div className={styles.fileName}>{selectedFile.name}</div>
                  <div className={styles.fileSize}>
                    {(selectedFile.size / 1024 / 1024).toFixed(2)}MB
                  </div>
                </div>

                {/* Progress bar */}
                <div className={styles.progressContainer}>
                  <div
                    className={styles.progressBar}
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className={styles.progressText}>{progress}%</div>

                {error && (
                  <div className={styles.errorMessage}>{error}</div>
                )}
              </div>
            </>
          )}

          {/* Error message */}
          {error && !selectedFile && (
            <div className={styles.errorBox}>{error}</div>
          )}
        </div>

        <div className={styles.footer}>
          <button
            className={styles.cancelButton}
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModelUploadDialog;
