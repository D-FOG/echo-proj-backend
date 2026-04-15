export const getPagination = (page?: string, limit?: string) => {
  const parsedPage = Math.max(Number(page ?? 1), 1);
  const parsedLimit = Math.min(Math.max(Number(limit ?? 10), 1), 100);

  return {
    page: parsedPage,
    limit: parsedLimit,
    skip: (parsedPage - 1) * parsedLimit,
  };
};
