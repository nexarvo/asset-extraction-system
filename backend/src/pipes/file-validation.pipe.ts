import { Injectable, PipeTransform } from '@nestjs/common';
import { ApplicationError } from '../error-codes/application-error';
import { ErrorCode } from '../error-codes/error-codes';
import { AssetFileInput, SupportedFileType } from '../utils/extraction.types';
import { getFileExtension, getSupportedFileType } from '../utils/file.utils';

@Injectable()
export class FileValidationPipe implements PipeTransform<AssetFileInput, AssetFileInput> {
  transform(value: AssetFileInput): AssetFileInput {
    if (!value.filename || !value.buffer || value.buffer.length === 0) {
      throw new ApplicationError(ErrorCode.ValidationFailed, 'A filename and non-empty buffer are required.');
    }

    try {
      getSupportedFileType(value);
      return value;
    } catch (error) {
      throw new ApplicationError(ErrorCode.UnsupportedFileType, undefined, {
        filename: value.filename,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export interface UploadedAssetFile {
  readonly originalname: string;
  readonly mimetype: string;
  readonly size: number;
  readonly buffer?: Buffer;
}

interface UploadedFileValidationOptions {
  readonly allowedFileTypes: readonly SupportedFileType[];
  readonly allowedMimeTypes: readonly string[];
  readonly fallbackMimeTypes?: readonly string[];
}

export class UploadedFileValidationPipe implements PipeTransform<UploadedAssetFile | undefined, AssetFileInput> {
  constructor(private readonly options: UploadedFileValidationOptions) {}

  transform(value: UploadedAssetFile | undefined): AssetFileInput {
    this.assertFileExists(value);
    this.assertFileHasContent(value);

    const input: AssetFileInput = {
      filename: value.originalname,
      mimeType: value.mimetype,
      buffer: value.buffer,
    };

    this.assertFileTypeAllowed(input);
    this.assertMimeTypeAllowed(value);
    return input;
  }

  private assertFileExists(value: UploadedAssetFile | undefined): asserts value is UploadedAssetFile & { buffer: Buffer } {
    if (!value || !value.buffer) {
      throw new ApplicationError(ErrorCode.ValidationFailed, 'A multipart file field named "file" is required.');
    }
  }

  private assertFileHasContent(value: UploadedAssetFile): void {
    if (value.size <= 0 || !value.buffer || value.buffer.length === 0) {
      throw new ApplicationError(ErrorCode.ValidationFailed, 'Uploaded file must not be empty.');
    }
  }

  private assertMimeTypeAllowed(value: UploadedAssetFile): void {
    const isAllowedMimeType = this.options.allowedMimeTypes.includes(value.mimetype);
    const isFallbackMimeType = this.options.fallbackMimeTypes?.includes(value.mimetype) ?? false;

    if (!isAllowedMimeType && !isFallbackMimeType) {
      throw new ApplicationError(ErrorCode.UnsupportedFileType, undefined, {
        filename: value.originalname,
        mimeType: value.mimetype,
      });
    }
  }

  private assertFileTypeAllowed(input: AssetFileInput): void {
    try {
      const fileType = getSupportedFileType(input);
      if (!this.options.allowedFileTypes.includes(fileType)) {
        throw new Error(`Unexpected file type for endpoint: ${fileType}`);
      }
    } catch (error) {
      throw new ApplicationError(ErrorCode.UnsupportedFileType, undefined, {
        filename: input.filename,
        extension: getFileExtension(input.filename),
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
