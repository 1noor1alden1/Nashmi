@echo off
cd /d "%~dp0"
python -m pip install -r ml/requirements.txt
if errorlevel 1 pause
