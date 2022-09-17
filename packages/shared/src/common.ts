export const extend = Object.assign

const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (
  val: object,
  key: string | symbol
): key is keyof typeof val => hasOwnProperty.call(val, key)

export const hasChanged = (value: any, oldValue: any): boolean =>
  !Object.is(value, oldValue)

// export const def = (obj: object, key: string | symbol, value: any) => {
//   Object.defineProperty(obj, key, {
//     configurable: true,
//     enumerable: false,
//     value
//   })
// }
