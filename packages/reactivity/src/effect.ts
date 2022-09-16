import { extend, isArray, isIntegerKey } from '@meils/shared'
import { createDep, Dep } from './dep'
import { TrackOpTypes, TriggerOpTypes } from './enums'
import { Target } from './reactive'

export interface ReactiveEffectOptions {
  lazy?: boolean
}

type KeyToDepMap = Map<any, Dep>

const targetMap = new WeakMap<any, KeyToDepMap>()

export let shouldTrack = true // 是否应该继续追逐呢

export let activeEffect: ReactiveEffect | undefined // 当前所

const trackStack: boolean[] = []

export function pauseTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = false
}

export function enableTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = true
}

export function resetTracking() {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}

export class ReactiveEffect<T = any> {
  active = true

  parent: ReactiveEffect | undefined = undefined

  deps: Dep[] = []

  constructor(public fn: () => T) {}

  run() {
    if (!this.active) {
      return this.fn()
    }

    let lastShouldTrack = shouldTrack // 记录上一个 shouldTrack 值
    try {
      this.parent = activeEffect // 上一个响应式副作用 ReactiveEffect

      // 将当前 ReactiveEffect 标记为 activeEffect
      activeEffect = this
      // 开启依赖收集
      shouldTrack = true

      // 执行下 effect 中的函数
      return this.fn()
    } finally {
      // fn 执行完毕后，恢复 shouldTrack 和 activeEffect
      shouldTrack = lastShouldTrack
      activeEffect = this.parent
      this.parent = undefined
    }
  }
}

/**
 * 副作用函数处理
 * @param fn
 * @param options
 */
export function effect<T = any>(fn: () => T, options?: ReactiveEffectOptions) {
  const _effect = new ReactiveEffect(fn)

  // _effect.options 挂载上 options 选项
  if (options) {
    extend(_effect, options)
  }

  if (!options || !options.lazy) {
    _effect.run()
  }
}

/**
 * 依赖收集
 * @param target
 * @param type 追踪类型
 * @param key
 */
export function track(
  target: Target,
  type: TrackOpTypes,
  key: string | symbol
) {
  if (shouldTrack && activeEffect) {
    // 可以进行追踪 && 存在激活的副作用函数
    // targetMap 存储所有的 target 的 depsMap
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }

    // 获取 target.key 的依赖
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = createDep()))
    }

    // dep 是依赖集，本质是 Set<ReactiveEffect>
    trackEffects(dep)
  }
}

export function trackEffects(dep: Dep) {
  if (shouldTrack) {
    dep.add(activeEffect!)
    activeEffect!.deps.push(dep)
  }
}

export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown
) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    // 未被追踪过
    return
  }

  let deps: (Dep | undefined)[] = [] // 收集所有的 dep 集合

  if (key === 'length' && isArray(target)) {
    // 更改数组的 .length 属性
    depsMap.forEach((dep, key) => {
      // 改了数组长度，也会影响数组其他元素
      // 小于收集的索引，那么这个索引也需要触发更新
      if (key === 'length' || key >= (newValue as number)) {
        deps.push(dep)
      }
    })
  } else {
    if (key !== void 0) {
      deps.push(depsMap.get(key))
    }

    switch (type) {
      case TriggerOpTypes.ADD:
        if (isArray(target) && isIntegerKey(key)) {
          // 新的索引添加到数组中，数组长度发生了变化
          // new index added to array -> length changes
          deps.push(depsMap.get('length'))
        }
        break
    }
  }

  if (deps.length === 1) {
    if (deps[0]) {
      triggerEffects(deps[0])
    }
  } else {
    const effects: ReactiveEffect[] = []
    for (const dep of deps) {
      if (dep) {
        effects.push(...dep)
      }
    }
    triggerEffects(createDep(effects))
  }
}

export function triggerEffects(dep: Dep | ReactiveEffect[]) {
  const effects = isArray(dep) ? dep : [...dep]
  for (const effect of effects) {
    triggerEffect(effect)
  }
}

function triggerEffect(effect: ReactiveEffect) {
  effect.run()
}
