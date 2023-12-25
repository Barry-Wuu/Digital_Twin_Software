call rd /s /q "out"
call npm run build
call node packager.js
call start "" "out/DemoApp-win32-x64/DemoApp.exe"