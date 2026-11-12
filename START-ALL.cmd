@echo off
cd /d "%~dp0"
if not exist .env.local (echo NOTE: .env.local missing. Starting frontend and ML only. API needs PostgreSQL.)
start "Nashmi ML" "%~dp0START-ML.cmd"
if exist .env.local start "Nashmi API" "%~dp0START-API.cmd"
start "Nashmi Frontend" "%~dp0START-FRONTEND.cmd"
echo Open http://localhost:5173 in your browser.
pause
