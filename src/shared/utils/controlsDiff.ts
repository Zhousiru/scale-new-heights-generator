/**
 * 数据驱动地判断一组控件是否偏离基准值。
 *
 * 传入需要关注的字段访问器列表，任一字段取值与 baseline 不同即视为「已改动」。
 * 用于「初始化时若存在非默认高级参数则自动展开高级设置」这类场景——
 * 新增/删除关注字段时只改访问器列表，不必再手写一长串 `||` 比较。
 */
export function hasChangedFields<T>(
  controls: T,
  baseline: T,
  accessors: ReadonlyArray<(value: T) => unknown>,
): boolean {
  return accessors.some((get) => get(controls) !== get(baseline))
}
