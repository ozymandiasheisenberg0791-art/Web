# 部署说明

这个项目已经改成 `Next.js` 网站，推荐部署到支持 Node/Next.js 的平台。

## 推荐平台

- `Vercel`
- `Netlify`

## 部署方法

### Vercel

1. 注册并登录 Vercel
2. 新建项目
3. 导入整个 `Web` 文件夹所在仓库，或上传项目源码
4. 保持默认 `Next.js` 配置
5. 部署完成后获得一个公网网址

### Netlify

1. 注册并登录 Netlify
2. 新建站点
3. 导入项目仓库
4. 构建命令填写 `npm run build`
5. 发布命令使用平台默认配置
6. 部署完成后获得一个公网网址

## 说明

- 本地开发前需要先安装 Node.js，并运行 `npm install`
- 当前网站使用 Next.js 路由，不再使用旧的本地 `index.html#/...` 方式
- `BLE` 和 `NFC` 真机能力通常需要 `HTTPS`
- 如果要在手机上跨设备访问，请优先部署到 `Vercel`
