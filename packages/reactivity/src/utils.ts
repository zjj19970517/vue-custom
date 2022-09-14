import { toRawType } from '@meils/shared'
import { ReactiveFlags, Target } from './reactive'

/**
 * 是否只读
 * @param value
 * @returns
 */
export function isReadonly(value: unknown): boolean {
  // 对象上存在 __v_isReadonly 标志为 只读
  return !!(value && (value as Target)[ReactiveFlags.IS_READONLY])
}

export function targetTypeMap(rawType: string) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON
    case 'Map':
    case 'Set':
    case 'WeakMap':
    case 'WeakSet':
      return TargetType.COLLECTION
    default:
      return TargetType.INVALID
  }
}

export function getTargetType(value: Target) {
  // 不可扩展对象 或 ReactiveFlags.SKIP ====> 无效类型
  return value[ReactiveFlags.SKIP] || !Object.isExtensible(value)
    ? TargetType.INVALID
    : targetTypeMap(toRawType(value))
}
