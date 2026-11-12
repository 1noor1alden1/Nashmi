@echo off
setlocal
cd /d "%~dp0"
if not exist .env.local (echo MISSING .env.local - copy from .env.local.example and configure development DB only. & pause & exit /b 1)
for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env.local") do if not "%%A"=="" set "%%A=%%B"
if not defined DATABASE_URL (echo DATABASE_URL is missing & pause & exit /b 1)
set "NODE_ENV=development"
set "PORT=3000"
echo API: http://127.0.0.1:3000/api/healthz
call pnpm.cmd --filter @workspace/api-server run dev
if errorlevel 1 pause
