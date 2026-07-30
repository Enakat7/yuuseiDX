@echo off
setlocal

set RULE_NAME_APP=Next.js Dev Server (3000)
set PORT_APP=3000

set RULE_NAME_SUPABASE=Supabase Local API (54321)
set PORT_SUPABASE=54321

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Administrator privileges required. Please click "Yes" on the UAC prompt.
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

netsh advfirewall firewall show rule name="%RULE_NAME_APP%" >nul 2>&1
if %errorlevel% equ 0 (
    echo Ports are currently OPEN. Closing...
    netsh advfirewall firewall delete rule name="%RULE_NAME_APP%"
    netsh advfirewall firewall delete rule name="%RULE_NAME_SUPABASE%"
    echo Port %PORT_APP% and %PORT_SUPABASE% closed.
) else (
    echo Ports are currently CLOSED. Opening...
    netsh advfirewall firewall add rule name="%RULE_NAME_APP%" dir=in action=allow protocol=TCP localport=%PORT_APP%
    netsh advfirewall firewall add rule name="%RULE_NAME_SUPABASE%" dir=in action=allow protocol=TCP localport=%PORT_SUPABASE%
    echo Port %PORT_APP% and %PORT_SUPABASE% opened.
)

echo.
pause
