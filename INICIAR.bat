@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Abrindo o OPTCG Analyzer...
start "" http://localhost:8080
node serve.js
pause
