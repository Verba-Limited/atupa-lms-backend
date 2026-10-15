export interface PageRequest {
  page: number;
  limit: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export const DEFAULT_PAGE: PageRequest = { page: 1, limit: 20 };

export function toSkip({ page, limit }: PageRequest): number {
  return (Math.max(page, 1) - 1) * limit;
}

export function mapPage<A, B>(page: Page<A>, fn: (item: A) => B): Page<B> {
  return { ...page, items: page.items.map(fn) };
}
