@echo off
setlocal
cd /d "%~dp0"
set "PYTHONUTF8=1"
py -3.13 -c "import sys" >nul 2>nul
if not errorlevel 1 (
  py -3.13 deploy\scripts\bootstrap.py
) else (
  python deploy\scripts\bootstrap.py
)
if errorlevel 1 (
  echo Setup failed. Check the error above.
  pause
  exit /b 1
)
pause
