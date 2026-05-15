@echo off
REM ============================
REM Start S-CORP Server & Open Chrome
REM ============================

REM Change directory to your project folder
cd /d "G:\Business Data\S- CORP"

REM Open Chrome at localhost:3000
start chrome http://localhost:3000

REM Start the Node.js server
node server.js

REM Keep CMD open to see logs
pause
