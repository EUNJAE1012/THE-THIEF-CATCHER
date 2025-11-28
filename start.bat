@echo off

echo === Building Client ===
cd client
call npm run build

echo === Starting Server ===
cd ../server
call npm run server

pause