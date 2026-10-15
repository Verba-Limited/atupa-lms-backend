import { Inject, Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '../../../shared/domain/errors';
import { Language } from '../domain/language.entity';
import type { LanguageRepository } from './ports/catalog.repositories.port';
import { LANGUAGE_REPOSITORY } from './ports/catalog.repositories.port';

/** Languages are data: adding a fourth language needs no code changes. */
@Injectable()
export class LanguagesService {
  constructor(
    @Inject(LANGUAGE_REPOSITORY) private readonly languages: LanguageRepository,
  ) {}

  list(includeInactive = false): Promise<Language[]> {
    return this.languages.list(includeInactive);
  }

  async create(input: {
    code: string;
    name: string;
    nativeName?: string;
    order?: number;
  }): Promise<Language> {
    const code = input.code.toLowerCase().trim();
    if (await this.languages.findByCode(code)) {
      throw new ConflictError(`Language ${code} already exists`);
    }
    return this.languages.create({
      ...input,
      code,
      isActive: true,
      order: input.order ?? 0,
    });
  }

  async update(
    code: string,
    patch: {
      name?: string;
      nativeName?: string;
      isActive?: boolean;
      order?: number;
    },
  ): Promise<Language> {
    const language = await this.languages.findByCode(code);
    if (!language) throw new NotFoundError('Language not found');
    return (await this.languages.update(language.id, patch)) as Language;
  }
}
