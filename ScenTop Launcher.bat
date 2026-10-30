@echo off
rem Double-click to open the ScenTop launcher: run the shop and admin studio on this computer,
rem and build or install the offline demo phone app. Every button shows the npm command it runs.
rem The window itself is scripts\launcher.ps1.
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0scripts\launcher.ps1"
