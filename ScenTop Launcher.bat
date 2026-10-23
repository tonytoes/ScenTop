@echo off
rem Double-click to open the ScenTop launcher: start/stop the API, the shop and the admin studio.
rem The window itself is scripts\launcher.ps1.
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0scripts\launcher.ps1"
