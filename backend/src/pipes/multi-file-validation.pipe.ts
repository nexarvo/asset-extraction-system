import { Injectable, PipeTransform } from '@nestjs/common';
import { ApplicationError } from '../error-codes/application-error';
import { ErrorCode } from '../error-codes/error-codes';
import { AssetFileInput, SupportedFileType } from '../utils/extraction.types';
import { getSupportedFileType } from '../utils/file.utils';

export interface UploadedAssetFile {
  readonly originalname: string;
  readonly mimetype: string;
  readonly size: number;
  readonly buffer?: Buffer;
}

interface MultiFileValidationOptions {
  readonly allowedFileTypes: readonly SupportedFileType[];
  readonly allowedMimeTypes: readonly string[];
  readonly fallbackMimeTypes?: readonly string[];
}

@Injectable()
export class MultiFileValidationPipe implements PipeTransform<
  UploadedAssetFile[] | undefined,
  AssetFileInput[]
> {
  constructor(private readonly options: MultiFileValidationOptions) {}

  transform(value: UploadedAssetFile[] | undefined): AssetFileInput[] {
    if (!value || value.length === 0) {
      throw new ApplicationError(
        ErrorCode.ValidationFailed,
        'At least one file is required.',
      );
    }

    const results: AssetFileInput[] = [];

    for (const file of value) {
      if (!file || !file.buffer || file.size === 0) {
        throw new ApplicationError(
          ErrorCode.ValidationFailed,
          'Each file must have content.',
        );
      }

      const input: AssetFileInput = {
        filename: file.originalname,
        mimeType: file.mimetype,
        buffer: file.buffer,
      };

      const fileType = this.getFileType(input);
      if (!this.options.allowedFileTypes.includes(fileType)) {
        throw new ApplicationError(ErrorCode.UnsupportedFileType, undefined, {
          filename: file.originalname,
          fileType,
        });
      }

      const isAllowedMimeType = this.options.allowedMimeTypes.includes(
        file.mimetype,
      );
      const isFallbackMimeType =
        this.options.fallbackMimeTypes?.includes(file.mimetype) ?? false;

      if (!isAllowedMimeType && !isFallbackMimeType) {
        throw new ApplicationError(ErrorCode.UnsupportedFileType, undefined, {
          filename: file.originalname,
          mimeType: file.mimetype,
        });
      }

      results.push(input);
    }

    return results;
  }

  private getFileType(input: AssetFileInput): SupportedFileType {
    try {
      return getSupportedFileType(input);
    } catch {
      throw new ApplicationError(ErrorCode.UnsupportedFileType, undefined, {
        filename: input.filename,
      });
    }
  }
}
