export interface BuildPrismaWhereParams {
  pageIndex: number | string;
  pageSize: number | string;
  enabled?: string;
  dateRange?: [string, string] | string;
  [key: string]: any;
}

export const buildPrismaWhere = (params: BuildPrismaWhereParams) => {
  const { pageIndex, pageSize, enabled, dateRange, orderBy, ...rest } = params;
  const skip = (Number(pageIndex) - 1) * Number(pageSize);
  const take = Number(pageSize);
  const where: any = {};
  if (enabled === 'true') {
    where.enabled = true;
  } else if (enabled === 'false') {
    where.enabled = false;
  }
  if (dateRange) {
    let newRange;
    if (typeof dateRange === 'string') {
      newRange = JSON.parse(dateRange);
    } else {
      newRange = dateRange;
    }
    const [start, end] = newRange as [string, string];
    where.createdAt = {
      gte: new Date(start),
      lte: new Date(end),
    };
  }
  if (Object.keys(rest).length === 0) {
    return { where, skip, take };
  }
  const newWhere = Object.entries(rest).reduce(
    (acc, [key, value]) => {
      if (value) {
        acc[key] = { contains: value };
      }
      return acc;
    },
    {} as Record<string, any>,
  );
  return { where: { ...where, ...newWhere }, skip, take, orderBy: orderBy ?? undefined };
};
