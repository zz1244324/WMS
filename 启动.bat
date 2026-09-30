@echo off
chcp 65001 >nul
title 仓库管理系统
cd /d "%~dp0"

echo.
echo ============================================
echo   仓库管理系统 - 本地启动
echo ============================================
echo.

if not exist "node_modules" (
  echo [1/3] 首次运行，正在安装依赖，可能需要几分钟...
  call npm install || goto :error
) else (
  echo [1/3] 依赖已就绪
)

if not exist "dist" (
  echo [2/3] 首次运行，正在构建页面...
  call npm run build || goto :error
) else (
  echo [2/3] 页面已构建
)

echo [3/3] 正在启动服务...
echo.
echo   浏览器访问： http://localhost:3333
echo   关闭本窗口即停止服务
echo.

start "" http://localhost:3333
call npm run serve
goto :eof

:error
echo.
echo 启动失败，请把上面的报错信息截图反馈。
pause
