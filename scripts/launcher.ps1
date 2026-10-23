# ScenTop launcher: a small window to start and stop the API, the shop and the admin studio.
# Opened by "ScenTop Launcher.bat" in the project folder. Windows only (Windows PowerShell 5.1+).

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Root '.data\logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# Keep npm and Angular quiet and free of colour codes, and never stop to ask questions
$env:NG_CLI_ANALYTICS = 'false'
$env:FORCE_COLOR = '0'
$env:NO_COLOR = '1'
$env:CI = ''

# ---- Colours -------------------------------------------------------------------------------------
function Rgb([string]$hex) { [System.Drawing.ColorTranslator]::FromHtml($hex) }
$C = @{
  Bg      = Rgb '#151217'
  Panel   = Rgb '#1f1b22'
  Panel2  = Rgb '#2a252e'
  Line    = Rgb '#3a333f'
  Ink     = Rgb '#f3eef4'
  Muted   = Rgb '#9d93a3'
  Rose    = Rgb '#e8798f'
  Gold    = Rgb '#d9ad4c'
  Green   = Rgb '#5cc58d'
  Amber   = Rgb '#e0a74a'
  Off     = Rgb '#5a5260'
}
$FontBody = New-Object System.Drawing.Font('Segoe UI', 9.5)
$FontBold = New-Object System.Drawing.Font('Segoe UI Semibold', 10.5)
$FontTitle = New-Object System.Drawing.Font('Georgia', 20, [System.Drawing.FontStyle]::Bold)
$FontSmall = New-Object System.Drawing.Font('Segoe UI', 8.5)
$FontMono = New-Object System.Drawing.Font('Consolas', 9)

# ---- Services ------------------------------------------------------------------------------------
$Services = [ordered]@{
  api   = @{ Name = 'API + database'; Script = 'api';   Port = 3000; Url = 'http://localhost:3000/api/health'; Color = $C.Gold;  Proc = $null; OpenWhenReady = $false; Up = $false }
  web   = @{ Name = 'Shop website';   Script = 'web';   Port = 4200; Url = 'http://localhost:4200';            Color = $C.Rose;  Proc = $null; OpenWhenReady = $false; Up = $false }
  admin = @{ Name = 'Admin studio';   Script = 'admin'; Port = 4300; Url = 'http://localhost:4300';            Color = (Rgb '#a593f2'); Proc = $null; OpenWhenReady = $false; Up = $false }
}
# One-off jobs (npm install, demo data) run one at a time
$script:Task = $null
$script:TaskDone = $null
$LogOffsets = @{}

function Test-Port([int]$port) {
  foreach ($hostName in @('127.0.0.1', '::1')) {
    $client = New-Object System.Net.Sockets.TcpClient($(if ($hostName -eq '::1') { [System.Net.Sockets.AddressFamily]::InterNetworkV6 } else { [System.Net.Sockets.AddressFamily]::InterNetwork }))
    try {
      $result = $client.BeginConnect($hostName, $port, $null, $null)
      if ($result.AsyncWaitHandle.WaitOne(120) -and $client.Connected) { return $true }
    } catch {
    } finally {
      $client.Close()
    }
  }
  return $false
}

function Start-Npm([string]$npmArgs, [string]$logName) {
  $log = Join-Path $LogDir "$logName.log"
  Set-Content -Path $log -Value '' -Encoding UTF8
  $LogOffsets[$logName] = 0
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = 'cmd.exe'
  $info.Arguments = "/c npm $npmArgs > `"$log`" 2>&1"
  $info.WorkingDirectory = $Root
  $info.UseShellExecute = $false
  $info.CreateNoWindow = $true
  return [System.Diagnostics.Process]::Start($info)
}

function Stop-Tree($proc) {
  if ($proc -and -not $proc.HasExited) {
    & taskkill.exe /PID $proc.Id /T /F 2>$null | Out-Null
  }
}

function Write-Log([string]$source, [string]$text) {
  $ansi = [regex]'\x1B\[[0-9;?]*[ -/]*[@-~]'
  foreach ($line in ($text -split "`r?`n")) {
    $clean = $ansi.Replace($line, '').TrimEnd()
    if ($clean.Length -eq 0) { continue }
    $LogBox.SelectionStart = $LogBox.TextLength
    $LogBox.SelectionColor = $C.Muted
    $LogBox.AppendText((Get-Date -Format 'HH:mm:ss') + '  ')
    $LogBox.SelectionColor = $(if ($Services.Contains($source)) { $Services[$source].Color } else { $C.Green })
    $LogBox.AppendText(('[' + $source + ']').PadRight(9))
    $LogBox.SelectionColor = $(if ($clean -match '(?i)\berror\b|failed|cannot|could not') { Rgb '#ff9c90' } else { $C.Ink })
    $LogBox.AppendText($clean + "`n")
  }
  # Keep the log from growing forever
  if ($LogBox.TextLength -gt 200000) { $LogBox.Select(0, 50000); $LogBox.SelectedText = '' }
  $LogBox.SelectionStart = $LogBox.TextLength
  $LogBox.ScrollToCaret()
}

function Read-NewLog([string]$name) {
  $path = Join-Path $LogDir "$name.log"
  if (-not (Test-Path $path)) { return }
  try {
    $stream = [System.IO.File]::Open($path, 'Open', 'Read', 'ReadWrite')
    try {
      $offset = [long]($LogOffsets[$name])
      if ($stream.Length -lt $offset) { $offset = 0 }
      if ($stream.Length -gt $offset) {
        $stream.Seek($offset, 'Begin') | Out-Null
        $reader = New-Object System.IO.StreamReader($stream)
        $text = $reader.ReadToEnd()
        $LogOffsets[$name] = $stream.Length
        Write-Log $name $text
      }
    } finally {
      $stream.Close()
    }
  } catch {
  }
}

function Assert-Ready {
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    [System.Windows.Forms.MessageBox]::Show('Node.js is not installed (or not on PATH). Install Node 22.12 or newer from https://nodejs.org and open the launcher again.', 'ScenTop', 'OK', 'Warning') | Out-Null
    return $false
  }
  if (-not (Test-Path (Join-Path $Root 'node_modules'))) {
    $answer = [System.Windows.Forms.MessageBox]::Show('The project packages are not installed yet. Install them now? (npm install, takes a few minutes)', 'ScenTop', 'YesNo', 'Question')
    if ($answer -eq 'Yes') { Start-Task 'install' 'Installing packages' $null }
    return $false
  }
  return $true
}

function Start-ScenService([string]$key, [bool]$open) {
  $svc = $Services[$key]
  if ($svc.Proc -and -not $svc.Proc.HasExited) { if ($open) { Open-Service $key }; return }
  if (Test-Port $svc.Port) {
    Write-Log $key "Port $($svc.Port) is already in use - it is probably already running in another window."
    if ($open) { Open-Service $key }
    return
  }
  if (-not (Assert-Ready)) { return }
  # The shop and admin need the API behind them
  if ($key -ne 'api') { Start-ScenService 'api' $false }
  Write-Log $key "Starting $($svc.Name)..."
  $svc.OpenWhenReady = $open
  $svc.Proc = Start-Npm "run $($svc.Script)" $key
}

function Stop-ScenService([string]$key) {
  $svc = $Services[$key]
  if ($svc.Proc -and -not $svc.Proc.HasExited) {
    Write-Log $key "Stopping $($svc.Name)"
    Stop-Tree $svc.Proc
  } elseif ($svc.Up) {
    Write-Log $key "$($svc.Name) was started outside the launcher. Close that window (or press Ctrl+C in it) to stop it."
  }
  $svc.Proc = $null
  $svc.OpenWhenReady = $false
}

function Open-Service([string]$key) {
  $url = $Services[$key].Url
  if ($key -eq 'api') { $url = 'http://localhost:3000/api/health' }
  Start-Process $url
}

function Start-Task([string]$kind, [string]$label, $then) {
  if ($script:Task -and -not $script:Task.HasExited) {
    [System.Windows.Forms.MessageBox]::Show('Another job is still running. Wait for it to finish.', 'ScenTop') | Out-Null
    return
  }
  $npmArgs = @{ install = 'install'; demo = 'run db:demo'; 'demo-clear' = 'run db:demo-clear'; seed = 'run db:seed' }[$kind]
  Write-Log 'task' "$label..."
  $script:TaskDone = $then
  $script:Task = Start-Npm $npmArgs 'task'
  $TaskLabel.Text = "$label..."
}

# The built-in dev database can only be opened by one program at a time, so database jobs pause the API
function Start-DatabaseTask([string]$kind, [string]$label) {
  if (-not (Assert-Ready)) { return }
  $apiWasRunning = $Services.api.Proc -and -not $Services.api.Proc.HasExited
  if ($apiWasRunning) { Stop-ScenService 'api' }
  $restart = if ($apiWasRunning) { { Start-ScenService 'api' $false } } else { $null }
  Start-Task $kind $label $restart
}

# ---- Window --------------------------------------------------------------------------------------
$Form = New-Object System.Windows.Forms.Form
$Form.Text = 'ScenTop Launcher'
$Form.Size = New-Object System.Drawing.Size(860, 680)
$Form.MinimumSize = New-Object System.Drawing.Size(760, 560)
$Form.StartPosition = 'CenterScreen'
$Form.BackColor = $C.Bg
$Form.ForeColor = $C.Ink
$Form.Font = $FontBody
$iconPath = Join-Path $Root 'src\assets\icon\favicon.png'
if (Test-Path $iconPath) {
  try { $Form.Icon = [System.Drawing.Icon]::FromHandle(([System.Drawing.Bitmap]::FromFile($iconPath)).GetHicon()) } catch {}
}

function New-Button([string]$text, [int]$w, $bg, $fg) {
  $b = New-Object System.Windows.Forms.Button
  $b.Text = $text
  $b.Width = $w
  $b.Height = 34
  $b.FlatStyle = 'Flat'
  $b.FlatAppearance.BorderSize = 1
  $b.FlatAppearance.BorderColor = $C.Line
  $b.BackColor = $bg
  $b.ForeColor = $fg
  $b.Cursor = 'Hand'
  $b.Font = $FontBody
  $b.Margin = New-Object System.Windows.Forms.Padding(0, 0, 8, 0)
  return $b
}

# Header
$Header = New-Object System.Windows.Forms.Panel
$Header.Dock = 'Top'
$Header.Height = 92
$Header.Padding = New-Object System.Windows.Forms.Padding(24, 18, 24, 10)
$Title = New-Object System.Windows.Forms.Label
$Title.Text = 'ScenTop'
$Title.Font = $FontTitle
$Title.ForeColor = $C.Ink
$Title.AutoSize = $true
$Title.Location = New-Object System.Drawing.Point(22, 14)
$Subtitle = New-Object System.Windows.Forms.Label
$Subtitle.Text = 'Start the shop and the admin studio without typing commands.'
$Subtitle.ForeColor = $C.Muted
$Subtitle.AutoSize = $true
$Subtitle.Location = New-Object System.Drawing.Point(25, 54)
$StartAll = New-Button 'Start everything' 150 $C.Rose (Rgb '#1f1a24')
$StartAll.Font = $FontBold
$StartAll.FlatAppearance.BorderColor = $C.Rose
$StartAll.Anchor = 'Top, Right'
$StopAll = New-Button 'Stop all' 90 $C.Panel $C.Ink
$StopAll.Anchor = 'Top, Right'
$Header.Controls.AddRange(@($Title, $Subtitle, $StartAll, $StopAll))
$Header.Add_Resize({
  $StopAll.Location = New-Object System.Drawing.Point(($Header.Width - 24 - $StopAll.Width), 24)
  $StartAll.Location = New-Object System.Drawing.Point(($StopAll.Left - 8 - $StartAll.Width), 24)
})

# Service cards
$Cards = New-Object System.Windows.Forms.TableLayoutPanel
$Cards.Dock = 'Top'
$Cards.Height = 150
$Cards.ColumnCount = 3
$Cards.RowCount = 1
$Cards.Padding = New-Object System.Windows.Forms.Padding(18, 0, 18, 0)
foreach ($i in 0..2) { $Cards.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle('Percent', 33.33))) | Out-Null }

$CardUi = @{}
foreach ($key in $Services.Keys) {
  $svc = $Services[$key]
  $card = New-Object System.Windows.Forms.Panel
  $card.Dock = 'Fill'
  $card.Margin = New-Object System.Windows.Forms.Padding(6)
  $card.BackColor = $C.Panel
  $card.Padding = New-Object System.Windows.Forms.Padding(16)

  $stripe = New-Object System.Windows.Forms.Panel
  $stripe.Dock = 'Top'
  $stripe.Height = 3
  $stripe.BackColor = $svc.Color

  $dot = New-Object System.Windows.Forms.Label
  $dot.Text = [char]0x25CF
  $dot.Font = New-Object System.Drawing.Font('Segoe UI', 12)
  $dot.ForeColor = $C.Off
  $dot.AutoSize = $true
  $dot.Location = New-Object System.Drawing.Point(12, 16)

  $name = New-Object System.Windows.Forms.Label
  $name.Text = $svc.Name
  $name.Font = $FontBold
  $name.AutoSize = $true
  $name.Location = New-Object System.Drawing.Point(34, 18)

  $state = New-Object System.Windows.Forms.Label
  $state.Text = 'Stopped'
  $state.ForeColor = $C.Muted
  $state.Font = $FontSmall
  $state.AutoSize = $true
  $state.Location = New-Object System.Drawing.Point(35, 42)

  $url = New-Object System.Windows.Forms.Label
  $url.Text = ('localhost:' + $svc.Port)
  $url.ForeColor = $C.Muted
  $url.Font = $FontSmall
  $url.AutoSize = $true
  $url.Location = New-Object System.Drawing.Point(35, 60)

  $toggle = New-Button 'Start' 76 $C.Panel2 $C.Ink
  $toggle.Location = New-Object System.Drawing.Point(14, 92)
  $toggle.Tag = $key
  $toggle.Add_Click({
    param($sender)
    $k = $sender.Tag
    if ($Services[$k].Up -or ($Services[$k].Proc -and -not $Services[$k].Proc.HasExited)) { Stop-ScenService $k } else { Start-ScenService $k ($k -ne 'api') }
  })

  $open = New-Button 'Open' 70 $C.Panel $C.Ink
  $open.Location = New-Object System.Drawing.Point(96, 92)
  $open.Tag = $key
  $open.Add_Click({ param($sender) Open-Service $sender.Tag })

  $card.Controls.AddRange(@($dot, $name, $state, $url, $toggle, $open, $stripe))
  $Cards.Controls.Add($card)
  $CardUi[$key] = @{ Dot = $dot; State = $state; Toggle = $toggle; Open = $open }
}

# Tools row
$Tools = New-Object System.Windows.Forms.FlowLayoutPanel
$Tools.Dock = 'Top'
$Tools.Height = 54
$Tools.Padding = New-Object System.Windows.Forms.Padding(24, 10, 24, 0)
$Tools.WrapContents = $false
$DemoBtn = New-Button 'Load demo sales data' 160 $C.Panel $C.Ink
$ClearBtn = New-Button 'Remove demo data' 140 $C.Panel $C.Ink
$InstallBtn = New-Button 'Install packages' 130 $C.Panel $C.Ink
$FolderBtn = New-Button 'Project folder' 120 $C.Panel $C.Ink
$TaskLabel = New-Object System.Windows.Forms.Label
$TaskLabel.AutoSize = $true
$TaskLabel.ForeColor = $C.Green
$TaskLabel.Margin = New-Object System.Windows.Forms.Padding(6, 9, 0, 0)
$Tools.Controls.AddRange(@($DemoBtn, $ClearBtn, $InstallBtn, $FolderBtn, $TaskLabel))

# Log
$LogWrap = New-Object System.Windows.Forms.Panel
$LogWrap.Dock = 'Fill'
$LogWrap.Padding = New-Object System.Windows.Forms.Padding(24, 6, 24, 20)
$LogTitle = New-Object System.Windows.Forms.Label
$LogTitle.Text = 'ACTIVITY'
$LogTitle.Dock = 'Top'
$LogTitle.Height = 22
$LogTitle.ForeColor = $C.Muted
$LogTitle.Font = $FontSmall
$LogBox = New-Object System.Windows.Forms.RichTextBox
$LogBox.Dock = 'Fill'
$LogBox.ReadOnly = $true
$LogBox.BackColor = (Rgb '#0f0d11')
$LogBox.ForeColor = $C.Ink
$LogBox.BorderStyle = 'None'
$LogBox.Font = $FontMono
$LogBox.DetectUrls = $true
$LogBox.Add_LinkClicked({ param($s, $e) Start-Process $e.LinkText })
$LogWrap.Controls.AddRange(@($LogBox, $LogTitle))

# Docked controls are laid out in reverse order of adding
$Form.Controls.AddRange(@($LogWrap, $Tools, $Cards, $Header))

# ---- Actions -------------------------------------------------------------------------------------
$StartAll.Add_Click({
  Start-ScenService 'api' $false
  Start-ScenService 'web' $true
  Start-ScenService 'admin' $true
})
$StopAll.Add_Click({ foreach ($k in @('admin', 'web', 'api')) { Stop-ScenService $k } })
$DemoBtn.Add_Click({
  $answer = [System.Windows.Forms.MessageBox]::Show("Add about 85 fake customers and 6 months of orders so the dashboard has something to show?`n`nReal accounts and orders are not touched. Run it again to refresh the dates.", 'Demo data', 'YesNo', 'Question')
  if ($answer -eq 'Yes') { Start-DatabaseTask 'demo' 'Creating demo customers and orders' }
})
$ClearBtn.Add_Click({ Start-DatabaseTask 'demo-clear' 'Removing demo data' })
$InstallBtn.Add_Click({
  if (Get-Command npm -ErrorAction SilentlyContinue) { Start-Task 'install' 'Installing packages' $null }
  else { Assert-Ready | Out-Null }
})
$FolderBtn.Add_Click({ Start-Process explorer.exe $Root })

# ---- Status loop ---------------------------------------------------------------------------------
$Timer = New-Object System.Windows.Forms.Timer
$Timer.Interval = 700
$Timer.Add_Tick({
  foreach ($key in $Services.Keys) {
    $svc = $Services[$key]
    $ui = $CardUi[$key]
    Read-NewLog $key
    $running = $svc.Proc -and -not $svc.Proc.HasExited
    if ($svc.Proc -and $svc.Proc.HasExited) {
      Write-Log $key "$($svc.Name) stopped (exit code $($svc.Proc.ExitCode))."
      $svc.Proc = $null
    }
    $svc.Up = Test-Port $svc.Port
    if ($svc.Up) {
      $ui.Dot.ForeColor = $C.Green
      $ui.State.Text = $(if ($running) { 'Running' } else { 'Running (outside launcher)' })
      $ui.Toggle.Text = 'Stop'
      if ($svc.OpenWhenReady) { $svc.OpenWhenReady = $false; Open-Service $key }
    } elseif ($running) {
      $ui.Dot.ForeColor = $C.Amber
      $ui.State.Text = 'Starting... (first build can take a minute)'
      $ui.Toggle.Text = 'Stop'
    } else {
      $ui.Dot.ForeColor = $C.Off
      $ui.State.Text = 'Stopped'
      $ui.Toggle.Text = 'Start'
    }
    $ui.Open.Enabled = $svc.Up
  }

  Read-NewLog 'task'
  if ($script:Task -and $script:Task.HasExited) {
    $ok = $script:Task.ExitCode -eq 0
    Write-Log 'task' $(if ($ok) { 'Done.' } else { "Failed (exit code $($script:Task.ExitCode)). See the lines above." })
    $TaskLabel.Text = $(if ($ok) { 'Done' } else { 'Failed - see activity' })
    $TaskLabel.ForeColor = $(if ($ok) { $C.Green } else { Rgb '#ff9c90' })
    $script:Task = $null
    $then = $script:TaskDone
    $script:TaskDone = $null
    if ($then) { & $then }
  }
})

$Form.Add_Shown({
  Write-Log 'task' "Project: $Root"
  Write-Log 'task' 'Press "Start everything". The shop opens at http://localhost:4200 and the admin studio at http://localhost:4300'
  Write-Log 'task' 'Admin login on this computer: see ADMIN_EMAIL / ADMIN_PASSWORD in .env.example'
  $Timer.Start()
})

$Form.Add_FormClosing({
  $running = @($Services.Keys | Where-Object { $Services[$_].Proc -and -not $Services[$_].Proc.HasExited })
  if ($running.Count -gt 0) {
    $answer = [System.Windows.Forms.MessageBox]::Show('Stop the running servers too?', 'ScenTop', 'YesNoCancel', 'Question')
    if ($answer -eq 'Cancel') { $_.Cancel = $true; return }
    if ($answer -eq 'Yes') { foreach ($k in @('admin', 'web', 'api')) { Stop-ScenService $k } }
  }
  if ($script:Task -and -not $script:Task.HasExited) { Stop-Tree $script:Task }
  $Timer.Stop()
})

[System.Windows.Forms.Application]::Run($Form)
