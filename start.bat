@echo off
echo ========================================
echo    Iniciando AnimalHumano...
echo ========================================
echo.

:: Iniciar Backend
echo [1/2] Iniciando Backend (puerto 5001)...
start "AnimalHumano - Backend" cmd /k "cd /d C:\Proyectos\AnimalHumano\backend && python app.py"

:: Esperar 2 segundos para que el backend arranque
timeout /t 2 /nobreak >nul

:: Iniciar Frontend
echo [2/2] Iniciando Frontend (puerto 4200)...
start "AnimalHumano - Frontend" cmd /k "cd /d C:\Proyectos\AnimalHumano\frontend && npm start"

:: Esperar a que el frontend compile y abrir el navegador
echo.
echo Esperando que compile el frontend...
timeout /t 12 /nobreak >nul

:: Abrir navegador
echo Abriendo navegador...
start http://localhost:4200

echo.
echo ========================================
echo    App lista en: http://localhost:4200
echo ========================================
echo.
echo Para cerrar la app, cierra las ventanas
echo de Backend y Frontend.
pause
