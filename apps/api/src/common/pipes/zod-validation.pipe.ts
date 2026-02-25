import { PipeTransform, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

/**
 * Generic Zod validation pipe.
 * Usage: @UsePipes(new ZodValidationPipe(MySchema))
 *
 * When used without a schema (as global pipe), it passes values through unchanged.
 * To validate a specific route, pass the schema to the constructor.
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // Only validate body params when a schema is provided
    if (!this.schema) return value;
    if (metadata.type !== 'body') return value;

    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: this.formatErrors(result.error),
      });
    }
    return result.data;
  }

  private formatErrors(error: ZodError): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const issue of error.errors) {
      const key = issue.path.join('.') || '_root';
      errors[key] = issue.message;
    }
    return errors;
  }
}
