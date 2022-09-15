import { createDep, Dep } from './dep'
import { TrackOpTypes } from './enums'
import { Target } from './reactive'

export interface ReactiveEffectOptions {
  lazy?: boolean
}

type KeyToDepMap = Map<any, Dep>
const targetMap = new WeakMap<any, KeyToDepMap>()

export let shouldTrack = true

export let activeEffect: ReactiveEffect | undefined

export class ReactiveEffect<T = any> {
  constructor(public fn: () => T) {}

  run() {}
}

export function effect<T = any>(fn: () => T, options?: ReactiveEffectOptions) {
  const _effect = new ReactiveEffect(fn)

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

export function trackEffects(dep: Dep) {}
