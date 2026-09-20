# MoonTV-Edgeone

<div align="center">
  <img src="public/logo.png" alt="MoonTV Logo" width="120">
</div>

> 🎬 **MoonTV-Edgeone** 是基于 [MoonTechLab/LunaTV](https://github.com/MoonTechLab/LunaTV)（MoonTV）的 **EdgeOne Pages / Makers** 适配版本。它保留原项目全部功能，将数据存储迁移到 **EdgeOne Blob**，支持在腾讯云 EdgeOne 免费全栈平台零服务器部署。
>
> 基于 **Next.js 14** + **Tailwind CSS** + **TypeScript** 构建，支持多资源搜索、在线播放、收藏同步、播放记录、云端存储，让你可以随时随地畅享海量免费影视内容。

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-14-000?logo=nextdotjs)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38bdf8?logo=tailwindcss)
![TypeScript](https://img.shields.io/badge/TypeScript-4.x-3178c6?logo=typescript)
![License](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-green)
![EdgeOne](https://img.shields.io/badge/Deploy-EdgeOne%20Pages-0064ff)

</div>

---

## ✨ 功能特性

- 🔍 **多源聚合搜索**：一次搜索立刻返回全源结果。
- 📄 **丰富详情页**：支持剧集列表、演员、年份、简介等完整信息展示。
- ▶️ **流畅在线播放**：集成 HLS.js & ArtPlayer。
- ❤️ **收藏 + 继续观看**：支持 EdgeOne Blob / Kvrocks / Redis / Upstash 存储，多端同步进度。
- ☁️ **EdgeOne Blob 存储**：数据持久化在腾讯云 EdgeOne Blob 对象存储中，Serverless 部署无需自建数据库。
- 📱 **PWA**：离线缓存、安装到桌面/主屏，移动端原生体验。
- 🌗 **响应式布局**：桌面侧边栏 + 移动底部导航，自适应各种屏幕尺寸。
- 👿 **智能去广告**：自动跳过视频中的切片广告（实验性）。

### 注意：部署后项目为空壳项目，无内置播放源和直播源，需要自行收集

<details>
  <summary>点击查看项目截图</summary>
  <img src="public/screenshot1.png" alt="项目截图" style="max-width:600px">
  <img src="public/screenshot2.png" alt="项目截图" style="max-width:600px">
  <img src="public/screenshot3.png" alt="项目截图" style="max-width:600px">
</details>

### 请不要在 B站、小红书、微信公众号、抖音、今日头条或其他中国大陆社交平台发布视频或文章宣传本项目，不授权任何"科技周刊/月刊"类项目或站点收录本项目。

## 🗺 目录

- [技术栈](#技术栈)
- [部署（EdgeOne Pages / Makers）](#部署edgeone-pages--makers详细步骤)
  - [方式一：EdgeOne 部署（推荐）](#方式一edgeone-部署推荐)
  - [方式二：Docker 部署（备选）](#方式二docker-部署备选)
  - [存储说明（EdgeOne Blob）](#存储说明edgeone-blob)
- [常见问题 FAQ](#常见问题-faq)
- [配置文件](#配置文件)
- [订阅](#订阅)
- [环境变量](#环境变量)
- [客户端](#客户端)
- [AndroidTV 使用](#AndroidTV-使用)
- [安全与隐私提醒](#安全与隐私提醒)
- [License](#license)
- [致谢](#致谢)

## 技术栈

| 分类      | 主要依赖                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------- |
| 前端框架  | [Next.js 14](https://nextjs.org/) · App Router                                                        |
| UI & 样式 | [Tailwind&nbsp;CSS 3](https://tailwindcss.com/)                                                       |
| 语言      | TypeScript 4                                                                                          |
| 播放器    | [ArtPlayer](https://github.com/zhw2590582/ArtPlayer) · [HLS.js](https://github.com/video-dev/hls.js/) |
| 存储      | [@edgeone/pages-blob](https://www.npmjs.com/package/@edgeone/pages-blob)（EdgeOne Blob）              |
| 代码质量  | ESLint · Prettier · Jest                                                                              |
| 部署      | EdgeOne Pages / Makers · Docker（备选）                                                               |

## 部署（EdgeOne Pages / Makers 详细步骤）

本项目已针对 **EdgeOne Pages（现名 EdgeOne Makers）** 全栈平台做过兼容适配：Next.js 构建、Blob 存储、中间件认证均可在该平台正常工作，**无需服务器、无需信用卡，免费额度即可个人使用**。

### 方式一：EdgeOne 部署（推荐）

#### 第 1 步：准备 GitHub 仓库

1. 在 GitHub 上 **Fork** 本仓库（`MoonTV-Edgeone`），或把代码推到你自己账号下的仓库。
2. 确保仓库根目录有 `pnpm-lock.yaml`（EdgeOne 会据此自动选择 pnpm 安装依赖）。

#### 第 2 步：在 EdgeOne 创建项目并连接仓库

1. 打开 [EdgeOne Makers 控制台](https://edgeone.ai/zh/products/pages)（腾讯云账号登录；国内版也可从腾讯云控制台 → EdgeOne → Pages / Makers 进入）。
2. 点击 **「新建项目」→「连接 Git 仓库」**，授权 GitHub 并选择你的仓库。

#### 第 3 步：构建设置

框架预设选择 **Next.js**，其余建议如下：

| 配置项 | 值 |
|---|---|
| 框架预设 | Next.js |
| 安装命令 | `pnpm install`（平台根据 lockfile 自动识别） |
| 构建命令 | `pnpm build` |
| 输出目录 | `.next`（Next.js 默认，自动识别） |
| **Node.js 版本** | **`20.18.0`**（⚠️ 重要，见下方说明） |

> ⚠️ **Node 版本必填 `20.18.0`**：仓库根目录的 `.nvmrc` 已指向该版本。EdgeOne 只预装固定的几个 Node 版本（14.21.3 / 16.20.2 / 18.20.4 / **20.18.0** / 22.11.0 / 22.17.1 / 22.21.1 / 24.x），如果你在项目设置里改了 Node 版本，请务必保持为预装列表内的版本，否则构建会报 `Failed to switch to Node.js`。

#### 第 4 步：配置环境变量

在项目的 **环境变量** 中添加：

```env
# ---- 必填 ----
NEXT_PUBLIC_STORAGE_TYPE=blob
USERNAME=admin
PASSWORD=换成你的强密码

# ---- 可选 ----
BLOB_STORE_NAME=moontv                      # EdgeOne Blob 命名空间名，默认 moontv
NEXT_PUBLIC_SITE_NAME=MoonTV-Edgeone        # 站点名（默认已是 MoonTV-Edgeone）
ANNOUNCEMENT=你的公告                        # 站点公告

# ---- 可选：豆瓣代理（国内加速推荐）----
NEXT_PUBLIC_DOUBAN_PROXY_TYPE=cmliussss-cdn-tencent
NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE=cmliussss-cdn-tencent

# ---- 可选：Blob 外部访问凭据（一般无需配置）----
# BLOB_PROJECT_ID=pages-xxxx
# BLOB_API_TOKEN=xxxx
```

> **说明**：部署在 EdgeOne 内部时，Blob 采用 name-only 模式（平台自动鉴权、首次调用自动创建命名空间），**无需**配置 `BLOB_PROJECT_ID` / `BLOB_API_TOKEN`。这两个变量仅供在本地脚本或其他外部服务中访问 Blob 时使用。

#### 第 5 步：部署

1. 点击 **部署**，等待构建完成（首次约 1–3 分钟）。
2. 部署成功后，平台分配 `xxx.edgeone.app`（或 `xxx.edgeone.dev`）免费域名，自动 HTTPS。

#### 第 6 步：（可选）绑定自定义域名

1. 控制台 **域名 → 添加域名**，按提示配置 DNS CNAME 记录。
2. 平台自动签发 SSL 证书。
3. ⚠️ 若域名要接入**中国大陆节点加速**，需要 ICP 备案；使用默认分配的 `edgeone.app` 域名则不需要。

#### 第 7 步：首次使用与验证

1. 浏览器打开分配的域名 → 会自动跳转登录页 → 用 `admin` + 密码登录。
2. **验证 Blob 存储**：登录后做任意数据操作（如后台保存一次播放源配置、收藏一部剧），然后到 EdgeOne 控制台 **Storage → Blob** 页面，应能看到 `moontv` 命名空间及其中的对象（如 `sys/admin-config`、`fav/...`、`pr/...`）。
3. **配置播放源**：登录后台 → **配置文件设置**，填入苹果 CMS V10 格式的播放源（项目为空壳，播放源需自行收集，格式见 [配置文件](#配置文件)）。

### 方式二：Docker 部署（备选）

本项目同样保留原项目的 Docker 部署能力（数据存储使用 Kvrocks / Redis / Upstash 时）。

```yml
services:
  moontv-core:
    image: ghcr.io/moontechlab/lunatv:latest
    container_name: moontv-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=kvrocks
      - KVROCKS_URL=redis://moontv-kvrocks:6666
    networks:
      - moontv-network
    depends_on:
      - moontv-kvrocks
  moontv-kvrocks:
    image: apache/kvrocks
    container_name: moontv-kvrocks
    restart: unless-stopped
    volumes:
      - kvrocks-data:/var/lib/kvrocks
    networks:
      - moontv-network
networks:
  moontv-network:
    driver: bridge
volumes:
  kvrocks-data:
```

> Redis / Upstash 存储的 compose 配置与原项目一致（分别设置 `REDIS_URL` 或 `UPSTASH_URL` / `UPSTASH_TOKEN`，并将 `NEXT_PUBLIC_STORAGE_TYPE` 改为 `redis` / `upstash`）。

### 存储说明（EdgeOne Blob）

当 `NEXT_PUBLIC_STORAGE_TYPE=blob` 时，数据全部持久化在 **EdgeOne Blob**（分布式对象存储，免费版 1GB 额度），Key 布局如下：

```
pr/{user}/{source}+{id}    -> JSON 播放记录
fav/{user}/{source}+{id}   -> JSON 收藏
user/{user}                -> 加盐哈希后的密码
sh/{user}                  -> JSON 搜索历史（最多 20 条）
skip/{user}/{source}+{id}  -> JSON 跳过片头片尾配置
sys/admin-config           -> JSON 站长配置
```

- 读取统一使用 **强一致模式**（`consistency: 'strong'`），保证登录校验、配置、收藏/播放记录的实时性。
- 控制台 **Storage → Blob** 可只读浏览命名空间与对象目录结构。
- 命名空间由 SDK 首次调用时自动创建，无需在控制台手动创建。

## 常见问题 FAQ

**Q1：构建报 `Failed to switch to Node.js v20.10.0`？**
> `.nvmrc` 指向的版本不在 EdgeOne 预装列表内。本仓库已改为 `v20.18.0`（预装版本）。若仍报错，请在项目设置 → Node.js Version 手动选择 `20.18.0`。

**Q2：构建期报 `PagesBlobError: Missing: token`？**
> 这是 `next build` 阶段（非运行时）加载 API 路由时尝试连接 Blob 所致。本仓库已修复：构建阶段自动跳过 Blob 连接（日志会出现 `EdgeOne Blob: skipping connection during build phase`），不影响运行时存储。

**Q3：部署后网页报 `Error return from script` / 一直重定向到登录页？**
> 原项目中间件依赖 `config.matcher` 排除公开路径，EdgeOne 适配器对该写法支持不完整导致所有路径（含 `/login`、静态资源）都被认证拦截，形成重定向死循环。本仓库已修复：公开路径判断全部移入中间件内部（`shouldSkipAuth`），`matcher` 改为全匹配。

**Q4：数据存在哪里？构建阶段不连 Blob 会不会丢数据？**
> 不会。构建阶段只是编译代码、产出静态文件，本就不需要存储；**运行时**（你登录、收藏、播放时）API 路由才真正读写 EdgeOne Blob，数据持久化在 `moontv` 命名空间。

**Q5：如何手动指定 Blob 外部访问凭据？**
> 在环境变量中设置 `BLOB_PROJECT_ID`（形如 `pages-xxxx`）与 `BLOB_API_TOKEN`（在 EdgeOne 控制台 API Token 页创建），SDK 将自动切换为显式 token 模式。

**Q6：安装依赖阶段报 husky 相关错误？**
> 在 EdgeOne 构建环境变量中增加 `HUSKY=0` 即可跳过 git hooks 安装。

## 配置文件

完成部署后为空壳应用，无播放源，需要站长在管理后台的配置文件设置中填写配置文件（后续会支持订阅）

配置文件示例如下：

```json
{
  "cache_time": 7200,
  "api_site": {
    "dyttzy": {
      "api": "http://xxx.com/api.php/provide/vod",
      "name": "示例资源",
      "detail": "http://xxx.com"
    }
    // ...更多站点
  },
  "custom_category": [
    {
      "name": "华语",
      "type": "movie",
      "query": "华语"
    }
  ]
}
```

- `cache_time`：接口缓存时间（秒）。
- `api_site`：你可以增删或替换任何资源站，字段说明：
  - `key`：唯一标识，保持小写字母/数字。
  - `api`：资源站提供的 `vod` JSON API 根地址。
  - `name`：在人机界面中展示的名称。
  - `detail`：（可选）部分无法通过 API 获取剧集详情的站点，需要提供网页详情根 URL，用于爬取。
- `custom_category`：自定义分类配置，用于在导航中添加个性化的影视分类。以 type + query 作为唯一标识。支持以下字段：
  - `name`：分类显示名称（可选，如不提供则使用 query 作为显示名）
  - `type`：分类类型，支持 `movie`（电影）或 `tv`（电视剧）
  - `query`：搜索关键词，用于在豆瓣 API 中搜索相关内容

custom_category 支持的自定义分类已知如下：

- movie：热门、最新、经典、豆瓣高分、冷门佳片、华语、欧美、韩国、日本、动作、喜剧、爱情、科幻、悬疑、恐怖、治愈
- tv：热门、美剧、英剧、韩剧、日剧、国产剧、港剧、日本动画、综艺、纪录片

也可输入如 "哈利波特" 效果等同于豆瓣搜索

MoonTV 支持标准的苹果 CMS V10 API 格式。

## 订阅

将完整的配置文件 base58 编码后提供 http 服务即为订阅链接，可在 MoonTV 后台/Helios 中使用。

## 环境变量

| 变量                                | 说明                                         | 可选值                           | 默认值                                                                                                                     |
| ----------------------------------- | -------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| USERNAME                            | 站长账号           | 任意字符串                       | 无默认，必填字段                                                                                                                     |
| PASSWORD                            | 站长密码           | 任意字符串                       | 无默认，必填字段                                                                                                                     |
| SITE_BASE                           | 站点 url              |       形如 https://example.com                  | 空                                                                                                                     |
| NEXT_PUBLIC_SITE_NAME               | 站点名称                                     | 任意字符串                       | MoonTV-Edgeone                                                                                                                     |
| ANNOUNCEMENT                        | 站点公告                                     | 任意字符串                       | 本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。 |
| NEXT_PUBLIC_STORAGE_TYPE            | 播放记录/收藏的存储方式                      | blob、redis、kvrocks、upstash | 无默认，必填字段                                                                                                               |
| BLOB_STORE_NAME                     | EdgeOne Blob 命名空间名                       | 任意字符串                       | moontv                                                                                                                      |
| BLOB_PROJECT_ID                     | EdgeOne Blob 项目 ID（外部访问时用）          | 形如 pages-xxxx                  | 空                                                                                                                         |
| BLOB_API_TOKEN                      | EdgeOne Blob API Token（外部访问时用）        | API Token                       | 空                                                                                                                         |
| KVROCKS_URL                           | kvrocks 连接 url                               | 连接 url                         | 空                                                                                                                         |
| REDIS_URL                           | redis 连接 url                               | 连接 url                         | 空                                                                                                                         |
| UPSTASH_URL                         | upstash redis 连接 url                       | 连接 url                         | 空                                                                                                                         |
| UPSTASH_TOKEN                       | upstash redis 连接 token                     | 连接 token                       | 空                                                                                                                         |
| NEXT_PUBLIC_SEARCH_MAX_PAGE         | 搜索接口可拉取的最大页数                     | 1-50                             | 5                                                                                                                          |
| NEXT_PUBLIC_DOUBAN_PROXY_TYPE       | 豆瓣数据源请求方式                           | 见下方                           | direct                                                                                                                     |
| NEXT_PUBLIC_DOUBAN_PROXY            | 自定义豆瓣数据代理 URL                       | url prefix                       | (空)                                                                                                                       |
| NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE | 豆瓣图片代理类型                             | 见下方                           | direct                                                                                                                     |
| NEXT_PUBLIC_DOUBAN_IMAGE_PROXY      | 自定义豆瓣图片代理 URL                       | url prefix                       | (空)                                                                                                                       |
| NEXT_PUBLIC_DISABLE_YELLOW_FILTER   | 关闭色情内容过滤                             | true/false                       | false                                                                                                                      |
| NEXT_PUBLIC_FLUID_SEARCH | 是否开启搜索接口流式输出 | true/ false | true |

NEXT_PUBLIC_DOUBAN_PROXY_TYPE 选项解释：

- direct: 由服务器直接请求豆瓣源站
- cors-proxy-zwei: 浏览器向 cors proxy 请求豆瓣数据，该 cors proxy 由 [Zwei](https://github.com/bestzwei) 搭建
- cmliussss-cdn-tencent: 浏览器向豆瓣 CDN 请求数据，该 CDN 由 [CMLiussss](https://github.com/cmliu) 搭建，并由腾讯云 cdn 提供加速
- cmliussss-cdn-ali: 浏览器向豆瓣 CDN 请求数据，该 CDN 由 [CMLiussss](https://github.com/cmliu) 搭建，并由阿里云 cdn 提供加速
- custom: 用户自定义 proxy，由 NEXT_PUBLIC_DOUBAN_PROXY 定义

NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE 选项解释：

- direct：由浏览器直接请求豆瓣分配的默认图片域名
- server：由服务器代理请求豆瓣分配的默认图片域名
- img3：由浏览器请求豆瓣官方的精品 cdn（阿里云）
- cmliussss-cdn-tencent：由浏览器请求豆瓣 CDN，该 CDN 由 [CMLiussss](https://github.com/cmliu) 搭建，并由腾讯云 cdn 提供加速
- cmliussss-cdn-ali：由浏览器请求豆瓣 CDN，该 CDN 由 [CMLiussss](https://github.com/cmliu) 搭建，并由阿里云 cdn 提供加速
- custom: 用户自定义 proxy，由 NEXT_PUBLIC_DOUBAN_IMAGE_PROXY 定义

## 客户端

v100.0.0 以上版本可配合 [Selene](https://github.com/MoonTechLab/Selene) 使用，移动端体验更加友好，数据完全同步

## AndroidTV 使用

目前该项目可以配合 [OrionTV](https://github.com/zimplexing/OrionTV) 在 Android TV 上使用，可以直接作为 OrionTV 后端

已实现播放记录和网页端同步

## 安全与隐私提醒

### 请设置密码保护并关闭公网注册

为了您的安全和避免潜在的法律风险，我们要求在部署时**强烈建议关闭公网注册**：

### 部署要求

1. **设置环境变量 `PASSWORD`**：为您的实例设置一个强密码
2. **仅供个人使用**：请勿将您的实例链接公开分享或传播
3. **遵守当地法律**：请确保您的使用行为符合当地法律法规

### 重要声明

- 本项目仅供学习和个人使用
- 请勿将部署的实例用于商业用途或公开服务
- 如因公开分享导致的任何法律问题，用户需自行承担责任
- 项目开发者不对用户的使用行为承担任何法律责任
- 本项目不在中国大陆地区提供服务。如有该项目在向中国大陆地区提供服务，属个人行为。在该地区使用所产生的法律风险及责任，属于用户个人行为，与本项目无关，须自行承担全部责任。特此声明

## License

[CC BY-NC-SA 4.0](LICENSE) © 2025 MoonTV & Contributors

本项目（MoonTV-Edgeone）是 [MoonTechLab/LunaTV](https://github.com/MoonTechLab/LunaTV)（MoonTV）的衍生项目，遵循原项目采用 [知识共享 署名-非商业性使用-相同方式共享 4.0 国际许可协议](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh)：禁止任何商业化行为；任何衍生项目必须保留本项目地址与版权署名，并以相同协议开源。

## 致谢

- [MoonTechLab/LunaTV](https://github.com/MoonTechLab/LunaTV) — 本项目基于的原项目。
- [ts-nextjs-tailwind-starter](https://github.com/theodorusclarence/ts-nextjs-tailwind-starter) — 项目最初基于该脚手架。
- [LibreTV](https://github.com/LibreSpark/LibreTV) — 由此启发，站在巨人的肩膀上。
- [ArtPlayer](https://github.com/zhw2590582/ArtPlayer) — 提供强大的网页视频播放器。
- [HLS.js](https://github.com/video-dev/hls.js) — 实现 HLS 流媒体在浏览器中的播放支持。
- [Zwei](https://github.com/bestzwei) — 提供获取豆瓣数据的 cors proxy
- [CMLiussss](https://github.com/cmliu) — 提供豆瓣 CDN 服务
- 感谢所有提供免费影视接口的站点。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=MoonTechLab/LunaTV&type=Date)](https://www.star-history.com/#MoonTechLab/LunaTV&Date)
