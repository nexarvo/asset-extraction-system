import { Injectable, PipeTransform } from '@nestjs/common';
import { ApplicationError } from '../error-codes/application-error';
import { ErrorCode } from '../error-codes/error-codes';
import { AssetFileInput } from '../utils/extraction.types';
import { getSupportedFileType } from '../utils/file.utils';

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
