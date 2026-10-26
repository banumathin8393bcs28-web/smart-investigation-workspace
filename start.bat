@echo off
title Smart Investigation Workspace
echo ==============================================================
echo  SMART INVESTIGATION WORKSPACE // SYSTEM LAUNCHER
echo ==============================================================
cd /d "%~dp0"

echo [1/3] Ensuring dependencies are installed...
call npm.cmd list mongoose >nul 2>&1
if %errorlevel% neq 0 (
  echo Installing missing dependencies...
  call npm.cmd install
)

echo [2/3] Checking MongoDB Community Server...
echo MongoDB Community Server must be running on 127.0.0.1:27017.

echo [3/3] Starting Smart Investigation Workspace Application...
echo Open your browser at: http://localhost:3000
echo.
echo Demo Accounts:
echo  1. detective.miller@gov.in  |  Password@123  (Lead Investigator)
echo  2. david.chen@gov.in        |  Password@123  (Senior Detective)
echo  3. kanya.t@gov.in           |  Password@123  (Cybercrime Investigator)
echo.
node server.js
pause
