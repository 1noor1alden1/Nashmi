@echo off
setlocal
cd /d "%~dp0"
echo.
echo === Nashmi Windows setup ===
where node >nul 2>nul || (echo ERROR: Install Node.js LTS or Node 24 first. & pause & exit /b 1)
where pnpm.cmd >nul 2>nul || (echo ERROR: Install pnpm first. & pause & exit /b 1)
echo Working in: %CD%
echo.
echo Installing workspace dependencies (pnpm 12 approved build scripts)...
call pnpm.cmd install --no-frozen-lockfile --force
if errorlevel 1 (echo INSTALL FAILED. Do not delete files. Send the LAST 20 lines. & pause & exit /b 1)
echo.
echo Verifying Vite and native Rollup...
call pnpm.cmd --filter @workspace/nashmi exec node -e "console.log('rollup:',require.resolve('@rollup/rollup-win32-x64-msvc'))"
if errorlevel 1 (echo Rollup native Windows module missing. Send this output. & pause & exit /b 1)
call pnpm.cmd --filter @workspace/nashmi exec vite --version
if errorlevel 1 (echo Vite check failed. & pause & exit /b 1)
echo.
echo Web dependencies installed OK. Next run START-FRONTEND.cmd
pause
