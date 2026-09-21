/**
 * 跨页复用的结构类型真值：凡是两个及以上页面出现的同形结构，只在此声明一次，
 * 页面类型与共用组件都从这里取，避免各页各抄一份（AGENTS.md §4 禁双写）。
 */

/** 「量 + 说明」二元组：内页 hero.stats 与首页案例区 metrics 共用同一形状。 */
export type LabeledValue = { value: string; label: string }
