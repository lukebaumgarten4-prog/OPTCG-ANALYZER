@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Subir o OPTCG Analyzer para o GitHub

echo.
echo ============================================================
echo   SUBIR O OPTCG ANALYZER PARA O GITHUB
echo ============================================================
echo.
echo   ANTES DE CONTINUAR, voce precisa ter criado o repositorio
echo   vazio no site. Se ainda nao criou:
echo.
echo     1. Abra  https://github.com/new
echo     2. Repository name:  optcg-analyzer
echo     3. Deixe marcado  Public
echo     4. NAO marque nenhuma caixinha (README, gitignore, license)
echo     5. Clique em  Create repository
echo.
echo ============================================================
echo.

set /p USUARIO="Digite seu usuario do GitHub e aperte Enter: "

if "%USUARIO%"=="" (
  echo.
  echo   Voce nao digitou nada. Rode o arquivo de novo.
  echo.
  pause
  exit /b 1
)

echo.
echo   Apontando o projeto para  https://github.com/%USUARIO%/optcg-analyzer
echo.

REM Se ja existir um "origin" de uma tentativa anterior, so troca o endereco.
git remote remove origin >nul 2>&1
git remote add origin https://github.com/%USUARIO%/optcg-analyzer.git
if errorlevel 1 goto :erro

echo   Enviando os arquivos...
echo.
echo   ATENCAO: na primeira vez vai abrir uma janela pedindo login.
echo   Escolha  "Sign in with your browser"  e faca o login normalmente.
echo.

git push -u origin main
if errorlevel 1 goto :erro

echo.
echo ============================================================
echo   DEU CERTO!
echo ============================================================
echo.
echo   Seus arquivos estao em:
echo     https://github.com/%USUARIO%/optcg-analyzer
echo.
echo   AGORA FALTAM 2 AJUSTES NO SITE DO GITHUB:
echo.
echo   [1] Liberar a atualizacao automatica dos dados
echo       Settings  ^>  Actions  ^>  General
echo       Role ate  "Workflow permissions"
echo       Marque  "Read and write permissions"  e clique em Save
echo.
echo   [2] Colocar o site no ar
echo       Settings  ^>  Pages
echo       Source:  "Deploy from a branch"
echo       Branch:  main   e pasta  / (root)   e clique em Save
echo.
echo   Espere uns 2 minutos e seu site estara em:
echo     https://%USUARIO%.github.io/optcg-analyzer/
echo.
pause
exit /b 0

:erro
echo.
echo ============================================================
echo   ALGO DEU ERRADO
echo ============================================================
echo.
echo   Confira:
echo    - o repositorio  optcg-analyzer  existe na sua conta?
echo    - o nome de usuario  %USUARIO%  esta escrito certo?
echo    - o repositorio foi criado VAZIO, sem README?
echo.
echo   Se a mensagem acima falar em "rejected" ou "non-fast-forward",
echo   abra o LEIA-ME do GitHub (GITHUB-PASSO-A-PASSO.md), secao
echo   "Quando der errado".
echo.
pause
exit /b 1
