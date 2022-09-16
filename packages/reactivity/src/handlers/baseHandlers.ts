import {
  extend,
  hasChanged,
  hasOwn,
  isArray,
  isIntegerKey,
  isObject,
  warn
} from '@meils/shared'

import { trigger } from '../effect'
import { TriggerOpTypes } from '../enums'
import { reactive, readonly, Target } from '../reactive'

const get = /*#__PURE__*/ createGetter()
const shallowGet = /*#__PURE__*/ createGetter(false, true)
const readonlyGet = /*#__PURE__*/ createGetter(true)
const shallowReadonlyGet = /*#__PURE__*/ createGetter(true, true)

const set = /*#__PURE__*/ createSetter()
const shallowSet = /*#__PURE__*/ createSetter(true)

export const mutableHandlers: ProxyHandler<object> = {
  get,
  set
}

export const readonlyHandlers: ProxyHandler<object> = {
  get: readonlyGet,
  // 只读禁止更新
  set(target, key) {
    if (__DEV__) {
      warn(
        `Set operation on key "${String(key)}" failed: target is readonly.`,
        target
      )
    }
    return true
  },
  // 只读禁止删除
  deleteProperty(target, key) {
    if (__DEV__) {
      warn(
        `Delete operation on key "${String(key)}" failed: target is readonly.`,
        target
      )
    }
    return true
  }
}

export const shallowReactiveHandlers: ProxyHandler<object> = extend(
  {},
  mutableHandlers,
  {
    get: shallowGet,
    set: shallowSet
  }
)

export const shallowReadonlyHandlers: ProxyHandler<object> = extend(
  {},
  readonlyHandlers,
  {
    get: shallowReadonlyGet
  }
)

function createGetter(isReadonly = false, shallow = false) {
  return function get(target: Target, key: string | symbol, receiver: object) {
    const res = Reflect.get(target, key, receiver)

    if (!isReadonly) {
      // 非只读，需要进行依赖收集
      // TODO:
    }

    if (shallow) {
      // 浅处理，直接返回，不需要进行递归处理了
      return res
    }

    // 如果求值后的返回值是对象类型，需要递归处理
    // Vue3 是浅代理，这是体现性能的一个关键点， Vue2 是一上来就递归
    if (isObject(res)) {
      return isReadonly ? readonly(res) : reactive(res)
    }

    return res
  }
}

function createSetter(shallow = false) {
  return function set(
    target: object,
    key: string | symbol,
    value: unknown,
    receiver: object
  ) {
    let oldValue = (target as any)[key]

    const hadKey =
      isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length
        : hasOwn(target, key)
    const res = Reflect.set(target, key, value, receiver)

    if (!hadKey) {
      // 新增
      trigger(target, TriggerOpTypes.ADD, key, value)
    } else if (hasChanged(value, oldValue)) {
      // 更新
      trigger(target, TriggerOpTypes.SET, key, value, oldValue)
    }

    return res
  }
}
