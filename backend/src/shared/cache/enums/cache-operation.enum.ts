/**
 * Cache operation enumeration for error categorization and monitoring
 */
export enum CacheOperation {
  // Read operations
  GET = 'cache.get',
  GET_WITH_OPTIONS = 'cache.getWithOptions',
  HAS = 'cache.has',
  KEYS = 'cache.keys',
  GET_STATS = 'cache.getStats',
  GET_TTL = 'cache.getTTL',

  // Write operations
  SET = 'cache.set',
  SET_WITH_TTL = 'cache.setWithTTL',
  MSET = 'cache.mset',

  // Delete operations
  DEL = 'cache.del',
  DEL_MANY = 'cache.delMany',
  MDEL = 'cache.mdel',

  // Management operations
  CLEAR = 'cache.clear',
  RESET = 'cache.reset',
  CLOSE = 'cache.close',

  // Batch operations
  MGET = 'cache.mget',
}

/**
 * Cache operation categories for error handling strategies
 */
export enum CacheOperationCategory {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  MANAGEMENT = 'management',
  BATCH = 'batch',
}

/**
 * Mapping from operation to category
 */
export const OPERATION_CATEGORY_MAP: Record<
  CacheOperation,
  CacheOperationCategory
> = {
  [CacheOperation.GET]: CacheOperationCategory.READ,
  [CacheOperation.GET_WITH_OPTIONS]: CacheOperationCategory.READ,
  [CacheOperation.HAS]: CacheOperationCategory.READ,
  [CacheOperation.KEYS]: CacheOperationCategory.READ,
  [CacheOperation.GET_STATS]: CacheOperationCategory.READ,
  [CacheOperation.GET_TTL]: CacheOperationCategory.READ,

  [CacheOperation.SET]: CacheOperationCategory.WRITE,
  [CacheOperation.SET_WITH_TTL]: CacheOperationCategory.WRITE,
  [CacheOperation.MSET]: CacheOperationCategory.WRITE,

  [CacheOperation.DEL]: CacheOperationCategory.DELETE,
  [CacheOperation.DEL_MANY]: CacheOperationCategory.DELETE,
  [CacheOperation.MDEL]: CacheOperationCategory.DELETE,

  [CacheOperation.CLEAR]: CacheOperationCategory.MANAGEMENT,
  [CacheOperation.RESET]: CacheOperationCategory.MANAGEMENT,
  [CacheOperation.CLOSE]: CacheOperationCategory.MANAGEMENT,

  [CacheOperation.MGET]: CacheOperationCategory.BATCH,
};

/**
 * Get operation category for a given cache operation
 */
export function getOperationCategory(
  operation: CacheOperation,
): CacheOperationCategory {
  return OPERATION_CATEGORY_MAP[operation];
}

/**
 * Check if an operation is a read operation
 */
export function isReadOperation(operation: CacheOperation): boolean {
  const category = getOperationCategory(operation);
  return category === CacheOperationCategory.READ;
}

/**
 * Check if an operation is a write operation
 */
export function isWriteOperation(operation: CacheOperation): boolean {
  const category = getOperationCategory(operation);
  return category === CacheOperationCategory.WRITE;
}

/**
 * Check if an operation is a management operation (critical)
 */
export function isManagementOperation(operation: CacheOperation): boolean {
  const category = getOperationCategory(operation);
  return category === CacheOperationCategory.MANAGEMENT;
}
