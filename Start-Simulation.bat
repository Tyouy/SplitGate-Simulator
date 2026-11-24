@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 goto use_py
where python >nul 2>nul
if not errorlevel 1 goto use_python
echo Python 3 was not found. Please install Python 3 and try again.
pause
exit /b 1
:use_py
py -3 server.py %*
goto finish
:use_python
python server.py %*
:finish
if errorlevel 1 pause
endlocal
