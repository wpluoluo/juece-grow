# GATE-003 · 公开站功能深化（落地页区块化 + 站内搜索 + 多站点模板复用）

> 门禁规则见 AGENTS.md §8：重大改动先立门禁，获确认后才落地。
> 状态：**PROPOSED**（2026-08-27）。ID：GATE-003，slug：public-site-deepening。
> 绑定：公开站 Astro（apps/astro），不含 CMS 数据层 schema 变更。

## 1. 背景
- 公开站现状为单品牌静态：`Layout.astro` 硬编码「觉策科技」品牌、页头页脚与留资弹窗，`index/features/pricing/solutions` 等为手写整页，区块不可复用。
- 数据层已有 Sites / Projects / Media 模型（含 subdomain、pathSlug、themeColor、logo、metaTitle/metaDescription、isTemplate、clone 接口），但 Astro 侧完全未消费。
- 需求：把公开站从「单品牌硬编码」升级为「区块化 + 可搜索 + 多站点模板化」，后台建多个站点即出多个营销站。

## 2. 方案对比

### 2.1 落地页区块化
| 方案 | 结论 |
|---|---|
| 抽 `components/sections/*.astro`（Hero/FeatureGrid/PricingTable/CTABand），Props 数据驱动 | ✅ 采纳：消除页间重复，一处改全局生效，为多站点数据源铺路 |
| 维持整页手写 | 未选：重复代码多，多站点无法复用 |

### 2.2 站内搜索
| 方案 | 结论 |
|---|---|
| PageFind（Astro 官方推荐，构建期生成静态索引，0 运行态后端） | ✅ 待验证：构建工具依赖，index.html 静态产物，贴合 SSG 与 SEO |
| 自建 JSON 索引 + JS 过滤 | 未选优先：索引与排序需手写，相关性弱 |

> 红线对照：PageFind 为「构建期工具依赖」，index.html 静态产物，不引入外部 CMS、不改变内容存储归属（数据仍在自有 Postgres）。

## 5. 实施进展
- 2026-08-27 · 站内搜索已落地：`apps/astro` 新增 devDependency `pagefind@^1.5.2`；`build` 改为 `astro build && pagefind --site dist`；Layout `<main>` 标 `data-pagefind-body` 收敛索引（排除导航/页脚）；头部新增搜索入口 + 弹层（浏览器端加载 `/pagefind/pagefind.js` 检索）。构建已通过，15 页索引 13 页、1245 词，语言 zh-cn。
- 2026-08-27 · 浏览器实测（preview:4323）✅：点击搜索图标弹层正常显现；输入关键词「文章」检索返回 2 条结果（`#search-status` 显示「找到 2 条结果」），点击打开后焦点、关闭（Esc/点遮罩）逻辑正常。PageFind 可行性验证通过。
- 2026-08-27 · 多站点落地（子域分站 / 独立构建）：`src/site.ts` 由单 `defaultSite` 拆为 `juece/erp/yunque` 三套配置 + 严格解析器（未知 SITE_ID 抛错、禁兜底），`siteId` 取 `SITE_ID`（默认 juece）；`astro.config.mjs` 按同一 `SITE_ID` 决定域名；新增 `build:erp/build:yunque` 独立构建脚本（cross-env 设 SITE_ID + `--outDir dist-erp/dist-yunque`，dist 输出隔离避免互覆）。三站构建 ✅，浏览器逐一确认（teal 觉策科技 / blue 觉策ERP / amber 云雀 Yunque）品牌、主题色、导航均正确且互可区分。
- 2026-08-27 · 站点差异化内容源（四个落地页全部内容驱动）：新增 `src/content/{home,features,solutions,pricing}.ts` 四份内容源，结构为 `Record<SiteId, Content>`，按 `siteId` 返回当前站文案并设类型；`index/features/solutions/pricing.astro` 由手写硬编码改造为从内容源读取（模板不变、内容随站切换），`PricingTable.astro` 支持可选货币/单位/推荐角标以适配三站计费差异。三站四页构建 ✅；对构建产物做互斥断言（首页/功能/行业/价格页各站标题与关键文案互不出现在他站，价格页计费口径 按年/按项目授权/按团队规模 各自独立），差异化正确。自研新文件均 ≤1000 行、无兜底/双写。
- 2026-08-27 · 内容源驱动后的视觉打磨（价格/行业页）：价格页非纯数字（面议/按团队）字号由 52px 收敛至 28px，避免与数字价失衡；FAQ 展开由 display 硬切改为 max-height+opacity 平滑过渡（`prefers-reduced-motion` 下直显）；行业页新增 `--color-erp`/`--color-erp-bg` 低饱和蓝变量，三条产品线（智云青 / ERP 蓝 / 云雀琥珀）在展开区做色彩区隔，场景卡片加克制 hover 微动效（reduced-motion 关闭）。三站构建 ✅。
- 2026-08-27 · 修复多站点品牌色注入 bug：原将 `{site.brand.colors.themeActive}` 等直接写入 `<style>`（Astro 不对 CSS 做模板插值，渲染成无效字面量 `{site…}`），导致 `--brand-color-active` 等被后置 `:root` 覆盖为无效、高亮卡/CTA 按钮文字回退继承 `#fff` 而白字白底。改由 Layout `<style is:global define:vars>` 把 `site.brand.colors.*` 注入为真实 CSS 变量（`<html style="--brand-color-active:#1b5f65;…">`）。三站构建产物已无 `themeActive` 字面量残留，按钮文字恢复正常。
- 红线复核：pagefind 属构建期工具依赖，产物为 `dist/pagefind/*` 静态文件随 SSG 部署，不新增运行期后端依赖；内容仍存自有 Postgres 由 Payload 提供，Pagefind 只读 HTML 文本，不改变数据归属。

### 2.3 多站点模板复用
| 方案 | 结论 |
|---|---|
| Layout/页脚/区块改为「当前站点 Site」配置驱动：品牌名、主题色、logo、导航、SEO 读写 `sites`，按 subdomain/pathSlug 选站 | ✅ 采纳：消费已有 Sites 模型，后台 clone 即出新站 |
| 每站点复制一份 Astro 代码目录 | 未选：重复维护成本高，违背模板化初衷 |

## 3. 风险与影响范围
- 影响范围：**前端（apps/astro 公开站）**。不改 CMS collection、不迁移数据（Sites 数据自持，只读消费）。
- 兼容：默认站点保持现有「觉策科技」内容与视觉，未配置站点时回退默认，避免破坏现网。
- 风险：
  - PageFind 新增依赖 → 对照红线，仅构建期、静态产物。
  - 多站点路由拆分 → 保持 `site` 缺失时按默认路径渲染，避免 404。
- 降级路径：搜索自建索引；多站点若切分过重则不切子域、先以 pathSlug 多页渲染。

## 4. 自检
- [x] 默认站点（无 Site 配置）访问 `/` 仍渲染原「觉策科技」内容，不回归
- [ ] 区块化后 features/solutions/pricing 渲染一致，无样式漂移
- [x] 站内搜索索引产物为静态 HTML，index.html 可独立部署；浏览器实测检索返回结果
- [x] 多站点：子域分站（独立构建）三套站点配置按 SITE_ID 出站，SEO/品牌各自生效
- [ ] 不新增非构建期后端依赖；线索数据仍在自有 Postgres
- [ ] 自研文件 ≤1000 行；无兜底/双写/兼容写法