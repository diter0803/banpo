# GitHub Pages 发布说明

这个项目保留本地部署方式不变：继续双击 `启动网站.bat` 即可本地运行。

GitHub Pages 使用单独的 `docs` 目录作为发布包，避免影响本地文件结构。

## 重新生成发布包

在项目根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\prepare-github-pages.ps1
```

脚本会重新生成 `docs` 目录，并复制网站所需的 `index.html`、`src`、`public`。

## 上传到 GitHub

1. 在 GitHub 新建一个仓库。
2. 将当前项目文件夹推送到仓库。
3. 打开仓库的 `Settings > Pages`。
4. `Source` 选择 `Deploy from a branch`。
5. `Branch` 选择 `main`，目录选择 `/docs`。
6. 保存后等待 GitHub Pages 构建完成。

## 注意

- 背景音乐文件已经包含在 `public/audio/douwu-banpo.mp3` 中，会随 `docs` 一起发布。
- “以纹观相”的摄像头识别功能首次使用时仍需要联网加载 MediaPipe 组件和模型。
- 如果修改了网站内容，重新运行发布脚本并再次推送即可更新线上版本。
