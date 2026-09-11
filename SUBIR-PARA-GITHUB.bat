@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Subir o OPTCG Analyzer para o GitHub

echo.
echo ============================================================
echo   ENVIAR SUAS MUDANCAS PARA O GITHUB
echo ============================================================
echo.

REM ---------- Ja existe um endereco configurado? ----------
for /f "delims=" %%u in ('git remote get-url origin 2^>nul') do set ATUAL=%%u

if not "%ATUAL%"=="" (
  echo   Este projeto ja aponta para:
  echo     %ATUAL%
  echo.
  goto :enviar
)

REM ---------- Primeira vez: perguntar e CONFERIR ----------
echo   Primeiro envio. Voce precisa ter criado o repositorio no site:
echo     1. Abra  https://github.com/new
echo     2. Repository name:  OPTCG-ANALYZER
echo     3. Deixe  Public  e NAO marque nenhuma caixinha
echo.
set /p USUARIO="Digite seu usuario do GitHub: "

if "%USUARIO%"=="" (
  echo.
  echo   Voce nao digitou nada. Rode o arquivo de novo.
  pause
  exit /b 1
)

echo.
echo   Conferindo se  %USUARIO%/OPTCG-ANALYZER  existe...

REM Confere ANTES de mexer em qualquer coisa. Um "a" trocado de lugar no nome
REM ja quebrou este projeto uma vez: o git aceita qualquer endereco, so reclama
REM la na hora do envio.
git ls-remote "https://github.com/%USUARIO%/OPTCG-ANALYZER.git" >nul 2>&1
if errorlevel 1 (
  echo.
  echo ============================================================
  echo   NAO ENCONTREI ESSE REPOSITORIO
  echo ============================================================
  echo.
  echo   Procurei por:  https://github.com/%USUARIO%/OPTCG-ANALYZER
  echo.
  echo   Confira:
  echo    - o usuario  %USUARIO%  esta escrito certo? (cuidado com
  echo      letras trocadas de lugar)
  echo    - o repositorio se chama mesmo  OPTCG-ANALYZER ?
  echo    - ele ja foi criado no site?
  echo.
  echo   Abra  https://github.com/%USUARIO%  no navegador e confira o
  echo   nome exato. Depois rode este arquivo de novo.
  echo.
  pause
  exit /b 1
)

echo   Encontrado. Configurando...
git remote remove origin >nul 2>&1
git remote add origin "https://github.com/%USUARIO%/OPTCG-ANALYZER.git"

:enviar

REM ---------- Tem mudanca sua ainda nao salva? ----------
REM O "git pull" se recusa a rodar com arquivo mexido pendente, entao
REM salvamos antes. Sem isto o script morre na cara do usuario.
REM
REM Isto NAO pode virar um bloco entre parenteses: o cmd troca as variaveis
REM pelo valor antes de rodar o bloco, entao a descricao sairia vazia.
git diff --quiet
if errorlevel 1 goto :salvar
git diff --cached --quiet
if errorlevel 1 goto :salvar
goto :baixar

:salvar
echo.
echo   Voce tem mudancas ainda nao salvas:
echo.
git status --short
echo.
set "DESCRICAO="
set /p DESCRICAO="Descreva em poucas palavras o que mudou: "
if not defined DESCRICAO set "DESCRICAO=mudancas locais"
git add -A
git commit -m "%DESCRICAO%"
if errorlevel 1 goto :erro_commit
echo.
echo   Salvo.

:baixar
echo.
echo   [1/2] Baixando o que o robo atualizou no GitHub...
echo.

REM O robo faz commit sozinho todo dia, entao o PC vive atrasado.
REM Sem baixar antes, o envio e recusado com "rejected".
git pull --rebase
if errorlevel 1 goto :erro_pull

echo.
echo   [2/2] Enviando suas mudancas...
echo.
echo   Se abrir uma janela de login, escolha "Sign in with your browser".
echo.

git push -u origin main
if errorlevel 1 goto :erro_push

echo.
echo ============================================================
echo   TUDO CERTO
echo ============================================================
for /f "delims=" %%u in ('git remote get-url origin') do echo   Repositorio: %%u
echo.
echo   Seu site (repare nas MAIUSCULAS do endereco):
for /f "tokens=4 delims=/" %%a in ('git remote get-url origin') do echo     https://%%a.github.io/OPTCG-ANALYZER/
echo.
pause
exit /b 0

:erro_pull
echo.
echo ============================================================
echo   NAO CONSEGUI BAIXAR AS ATUALIZACOES
echo ============================================================
echo.
echo   Se a mensagem acima fala em "conflict", voce e o robo mexeram
echo   no mesmo arquivo. Me chame que eu resolvo.
echo.
pause
exit /b 1

:erro_push
echo.
echo ============================================================
echo   NAO CONSEGUI ENVIAR
echo ============================================================
echo.
echo   Causas comuns:
echo    - login cancelado ou expirado: rode de novo e faca o login
echo    - permissao: voce e mesmo o dono deste repositorio?
echo.
pause
exit /b 1
