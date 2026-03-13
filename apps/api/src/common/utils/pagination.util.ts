export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function buildPageMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function buildPaginatedResponse<T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
): { items: T[] } & PaginationMeta {
  return {
    items,
    ...buildPageMeta(page, pageSize, total),
  };
}

export function buildEmptyPaginatedResponse<T>(
  page: number,
  pageSize: number,
): { items: T[] } & PaginationMeta {
  return buildPaginatedResponse<T>([], page, pageSize, 0);
}
