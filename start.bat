@echo off

echo --- CLIENT 빌드 ---
cd client
npm run build

echo --- SERVER 실행 ---
cd ../server
npm run server

pause
