@echo off
setlocal
cd /d "%~dp0"
where docker >nul 2>nul || (echo Docker Desktop is required for this optional local DB setup. & pause & exit /b 1)
echo WARNING: only for a NEW local development database on port 5439.
choice /M "Start the separate local development PostgreSQL container"
if errorlevel 2 exit /b 0
docker compose up -d --wait
if errorlevel 1 (echo Check Docker Desktop is running. & pause & exit /b 1)
if not exist .env.local copy .env.local.example .env.local >nul
for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env.local") do if not "%%A"=="" set "%%A=%%B"
echo %DATABASE_URL% | findstr /C:"@127.0.0.1:5439/nashmi_dev" >nul
if errorlevel 1 (echo REFUSED: .env.local does not point to the dedicated development DB on 127.0.0.1:5439/nashmi_dev. & pause & exit /b 1)
echo Initializing DB schema for local development only...
call pnpm.cmd --filter @workspace/db run push
if errorlevel 1 (echo Schema setup failed; DO NOT use another database until reviewed. & pause & exit /b 1)
echo Database ready. Now START-ALL.cmd
pause
