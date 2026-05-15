@echo off
echo Stopping all Node processes...
taskkill /f /im node.exe 2>nul
timeout /t 2 /nobreak >nul

echo Deleting Data folder...
rmdir /s /q Data 2>nul

echo Creating fresh Data folder...
mkdir Data 2>nul

echo Done!
dir Data
pause