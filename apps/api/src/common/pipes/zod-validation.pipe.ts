import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const UNSAFE_CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodSchema) {}

  transform(value: unknown): unknown {
    if (!this.schema) {
      return value;
    }

    const result = this.schema.safeParse(value);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      throw new BadRequestException({
        message: 'Validation failed',
        errors,
      });
    }

    this.assertNoUnsafePayload(result.data);
    return result.data;
  }

  private assertNoUnsafePayload(value: unknown, visited = new WeakSet<object>()): void {
    if (typeof value === 'string') {
      if (UNSAFE_CONTROL_CHAR_REGEX.test(value)) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: { body: ['Input contains unsupported control characters'] },
        });
      }
      return;
    }

    if (!value || typeof value !== 'object') {
      return;
    }

    if (visited.has(value)) {
      return;
    }
    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        this.assertNoUnsafePayload(item, visited);
      }
      return;
    }

    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_OBJECT_KEYS.has(key)) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: { body: [`Field "${key}" is not allowed`] },
        });
      }
      this.assertNoUnsafePayload(nested, visited);
    }
  }
}
