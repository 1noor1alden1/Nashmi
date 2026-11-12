@echo off
cd /d "%~dp0"
set "PORT=5173"
set "BASE_PATH=/"
set "API_PROXY_TARGET=http://127.0.0.1:3000"
echo Frontend: http://localhost:5173
echo Backend proxy: http://127.0.0.1:3000
call pnpm.cmd --filter @workspace/nashmi run dev
if errorlevel 1 pause
