import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 关闭 Next 内置的开发者工具悬浮按钮（英文面板，与后台无关），避免干扰。
  devIndicators: false,
}

export default withPayload(nextConfig)