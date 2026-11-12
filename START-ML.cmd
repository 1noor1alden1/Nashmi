@echo off
cd /d "%~dp0"
where python >nul 2>nul || (echo Install Python 3.11+ first & pause & exit /b 1)
echo ML docs: http://127.0.0.1:8001/docs
python -m uvicorn ml.service.app:app --host 127.0.0.1 --port 8001
if errorlevel 1 (echo First run INSTALL-ML.cmd & pause)
