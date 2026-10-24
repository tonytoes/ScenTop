# ScenTop launcher: one window to run the shop on this computer and to build and install the phone app.
# Opened by "ScenTop Launcher.bat" in the project folder. Windows only (Windows PowerShell 5.1+).
# Every button shows the terminal command it runs, so people can learn the commands or run them by hand.

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Root '.data\logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$DemoApk = Join-Path $Root 'ScenTop-demo.apk'

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
  Muted   = Rgb '#a89eae'
  Rose    = Rgb '#e8798f'
  Gold    = Rgb '#d9ad4c'
  Green   = Rgb '#5cc58d'
  Amber   = Rgb '#e0a74a'
  Red     = Rgb '#ff9c90'
  Off     = Rgb '#5a5260'
  Code    = Rgb '#e6c47a'
}
$FontBody = New-Object System.Drawing.Font('Segoe UI', 9.5)
$FontBold = New-Object System.Drawing.Font('Segoe UI Semibold', 10.5)
$FontTitle = New-Object System.Drawing.Font('Georgia', 20, [System.Drawing.FontStyle]::Bold)
$FontSmall = New-Object System.Drawing.Font('Segoe UI', 8.5)
$FontSection = New-Object System.Drawing.Font('Segoe UI Semibold', 8.5)
$FontMono = New-Object System.Drawing.Font('Consolas', 9)

# ---- Services (keep running until stopped) -------------------------------------------------------
$Services = [ordered]@{
  api   = @{
    Name = 'API + database'; Script = 'api'; Port = 3000; Url = 'http://localhost:3000/api/health'; Color = $C.Gold
    About = 'The engine behind the shop: products, accounts, orders and email-code login. The website and admin start it for you.'
    Proc = $null; OpenWhenReady = $false; Up = $false
  }
  web   = @{
    Name = 'Shop website'; Script = 'web'; Port = 4200; Url = 'http://localhost:4200'; Color = $C.Rose
    About = 'The store customers use. Opens in your browser at localhost:4200 when it is ready (the first start takes about a minute).'
    Proc = $null; OpenWhenReady = $false; Up = $false
  }
  admin = @{
    Name = 'Admin studio'; Script = 'admin'; Port = 4300; Url = 'http://localhost:4300'; Color = (Rgb '#a593f2')
    About = 'Manage products, orders and customers. On this computer log in with admin@scentop.local / admin12345.'
    Proc = $null; OpenWhenReady = $false; Up = $false
  }
}
# One-off jobs (build the APK, install packages, demo data) run one at a time
$script:Task = $null
$script:TaskDone = $null
$script:TaskLabelText = ''
$LogOffsets = @{}

# Reads Windows' list of listening ports instead of connecting to each one: a connection to a closed
# port takes Windows hundreds of milliseconds to refuse, which froze the window when it ran every tick.
function Get-ListeningPorts {
  try { return @([System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | ForEach-Object { $_.Port }) } catch { return @() }
}

function Test-Port([int]$port) {
  return (Get-ListeningPorts) -contains $port
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
    $LogBox.SelectionColor = $(if ($clean -match '(?i)\berror\b|failed|cannot|could not') { $C.Red } elseif ($clean -match '^> ') { $C.Code } else { $C.Ink })
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
  if (-not (Test-Path (Join-Path $Root 'node_modules\@neondatabase\auth'))) {
    $answer = [System.Windows.Forms.MessageBox]::Show("Some project packages are missing. Install them now?`n`nRuns: npm install  (takes a few minutes)", 'ScenTop', 'YesNo', 'Question')
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
  Write-Log $key "Starting $($svc.Name)   > npm run $($svc.Script)"
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
  Start-Process $Services[$key].Url
}

# ---- Jobs ----------------------------------------------------------------------------------------
# Each job: the npm arguments it runs, a short name for the log, and whether it needs the database to itself
$Jobs = @{
  install      = @{ Args = 'install';                Busy = 'Installing packages' }
  'apk-build'  = @{ Args = 'run android:demo';       Busy = 'Building the demo APK (2-5 minutes)' }
  'apk-install'= @{ Args = 'run android:install';    Busy = 'Installing the APK on the phone' }
  demo         = @{ Args = 'run db:demo';            Busy = 'Creating demo customers and orders'; Database = $true }
  'demo-clear' = @{ Args = 'run db:demo-clear';      Busy = 'Removing demo customers and orders'; Database = $true }
}

function Start-Task([string]$kind, [string]$label, $then) {
  if ($script:Task -and -not $script:Task.HasExited) {
    [System.Windows.Forms.MessageBox]::Show("Another job is still running ($script:TaskLabelText). Wait for it to finish.", 'ScenTop') | Out-Null
    return
  }
  $npmArgs = $Jobs[$kind].Args
  Write-Log 'job' "$label   > npm $npmArgs"
  $script:TaskDone = $then
  $script:TaskLabelText = $label
  $script:Task = Start-Npm $npmArgs 'job'
  $TaskLabel.Text = "Working: $label..."
  $TaskLabel.ForeColor = $C.Amber
}

# The built-in dev database can only be opened by one program at a time, so database jobs pause the API
function Start-LauncherJob([string]$kind) {
  $job = $Jobs[$kind]
  if ($kind -ne 'install' -and -not (Assert-Ready)) { return }
  $restart = $null
  if ($job.Database) {
    $apiWasRunning = $Services.api.Proc -and -not $Services.api.Proc.HasExited
    if ($apiWasRunning) { Stop-ScenService 'api'; $restart = { Start-ScenService 'api' $false } }
  }
  Start-Task $kind $job.Busy $restart
}

# ---- Window --------------------------------------------------------------------------------------
$Form = New-Object System.Windows.Forms.Form
$Form.Text = 'ScenTop Launcher'
$Form.Size = New-Object System.Drawing.Size(1020, 820)
$Form.MinimumSize = New-Object System.Drawing.Size(900, 760)
$Form.StartPosition = 'CenterScreen'
$Form.BackColor = $C.Bg
$Form.ForeColor = $C.Ink
$Form.Font = $FontBody
$iconPath = Join-Path $Root 'src\assets\icon\favicon.png'
if (Test-Path $iconPath) {
  try { $Form.Icon = [System.Drawing.Icon]::FromHandle(([System.Drawing.Bitmap]::FromFile($iconPath)).GetHicon()) } catch {}
}
$Tips = New-Object System.Windows.Forms.ToolTip
$Tips.AutoPopDelay = 15000

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
  return $b
}

function New-Text([string]$text, $font, $color, [int]$x, [int]$y, [int]$w, [int]$h) {
  $l = New-Object System.Windows.Forms.Label
  $l.Text = $text
  $l.Font = $font
  $l.ForeColor = $color
  $l.Location = New-Object System.Drawing.Point($x, $y)
  $l.Size = New-Object System.Drawing.Size($w, $h)
  $l.Anchor = 'Top, Left, Right'
  return $l
}

# The command line under each description, so people can see (and copy) what the button runs
function New-Command([string]$command, [int]$x, [int]$y, [int]$w) {
  $l = New-Text ('> ' + $command) $FontMono $C.Code $x $y $w 18
  $l.Cursor = 'Hand'
  $Tips.SetToolTip($l, 'Click to copy this command')
  $l.Tag = $command
  $l.Add_Click({ param($sender) [System.Windows.Forms.Clipboard]::SetText($sender.Tag); Write-Log 'job' "Copied to clipboard: $($sender.Tag)" })
  return $l
}

# Windows display scaling moves and grows controls, so wrapped text is re-fitted whenever its panel changes size
function Set-FitText($panel) {
  $panel.Add_Resize({
    param($sender)
    foreach ($c in $sender.Controls) {
      if ($c -is [System.Windows.Forms.Label] -and -not $c.AutoSize) { $c.Width = [math]::Max(60, $sender.ClientSize.Width - $c.Left - 12) }
    }
  })
}

function New-Section([string]$text) {
  $l = New-Object System.Windows.Forms.Label
  $l.Text = $text
  $l.Dock = 'Top'
  $l.Height = 26
  $l.Padding = New-Object System.Windows.Forms.Padding(26, 8, 0, 0)
  $l.ForeColor = $C.Muted
  $l.Font = $FontSection
  return $l
}

# Header
$Header = New-Object System.Windows.Forms.Panel
$Header.Dock = 'Top'
$Header.Height = 94
$Title = New-Object System.Windows.Forms.Label
$Title.Text = 'ScenTop'
$Title.Font = $FontTitle
$Title.ForeColor = $C.Ink
$Title.AutoSize = $true
$Title.Location = New-Object System.Drawing.Point(22, 14)
$Subtitle = New-Object System.Windows.Forms.Label
$Subtitle.Text = "Run the shop on this computer and make the phone app - no typing needed.`nEach button shows the command it runs (click a command to copy it)."
$Subtitle.ForeColor = $C.Muted
$Subtitle.AutoSize = $true
$Subtitle.Location = New-Object System.Drawing.Point(25, 54)
$StartAll = New-Button 'Start everything' 150 $C.Rose (Rgb '#1f1a24')
$StartAll.Font = $FontBold
$StartAll.FlatAppearance.BorderColor = $C.Rose
$StopAll = New-Button 'Stop all' 90 $C.Panel $C.Ink
$StartAllCmd = New-Object System.Windows.Forms.Label
$StartAllCmd.Text = '> npm run api + web + admin'
$StartAllCmd.Font = $FontMono
$StartAllCmd.ForeColor = $C.Code
$StartAllCmd.AutoSize = $true
$Tips.SetToolTip($StartAll, "Starts the API, the shop website and the admin studio, then opens both in your browser.`nRuns: npm run api, npm run web, npm run admin")
$Tips.SetToolTip($StopAll, 'Stops everything this launcher started.')
$Header.Controls.AddRange(@($Title, $Subtitle, $StartAll, $StopAll, $StartAllCmd))
$Header.Add_Resize({
  $StopAll.Location = New-Object System.Drawing.Point(($Header.Width - 26 - $StopAll.Width), 22)
  $StartAll.Location = New-Object System.Drawing.Point(($StopAll.Left - 8 - $StartAll.Width), 22)
  $StartAllCmd.Location = New-Object System.Drawing.Point(($Header.Width - 26 - $StartAllCmd.Width), 64)
})

# Service cards
$Cards = New-Object System.Windows.Forms.TableLayoutPanel
$Cards.Dock = 'Top'
$Cards.Height = 200
$Cards.ColumnCount = 3
$Cards.RowCount = 1
$Cards.Padding = New-Object System.Windows.Forms.Padding(18, 0, 18, 0)
foreach ($i in 0..2) { $Cards.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle('Percent', 33.33))) | Out-Null }

$CardUi = @{}
foreach ($key in $Services.Keys) {
  $svc = $Services[$key]
  $card = New-Object System.Windows.Forms.Panel
  $card.Size = New-Object System.Drawing.Size(300, 200)
  $card.Dock = 'Fill'
  $card.Margin = New-Object System.Windows.Forms.Padding(6)
  $card.BackColor = $C.Panel

  $stripe = New-Object System.Windows.Forms.Panel
  $stripe.Dock = 'Top'
  $stripe.Height = 3
  $stripe.BackColor = $svc.Color

  $dot = New-Object System.Windows.Forms.Label
  $dot.Text = [char]0x25CF
  $dot.Font = New-Object System.Drawing.Font('Segoe UI', 12)
  $dot.ForeColor = $C.Off
  $dot.AutoSize = $true
  $dot.Location = New-Object System.Drawing.Point(12, 14)

  $name = New-Object System.Windows.Forms.Label
  $name.Text = $svc.Name
  $name.Font = $FontBold
  $name.AutoSize = $true
  $name.Location = New-Object System.Drawing.Point(34, 16)

  $state = New-Text 'Stopped' $FontSmall $C.Muted 35 40 250 18
  $about = New-Text $svc.About $FontSmall $C.Ink 14 62 272 50
  $command = New-Command "npm run $($svc.Script)" 14 114 272

  $toggle = New-Button 'Start' 76 $C.Panel2 $C.Ink
  $toggle.Location = New-Object System.Drawing.Point(14, 140)
  $toggle.Tag = $key
  $toggle.Add_Click({
    param($sender)
    $k = $sender.Tag
    if ($Services[$k].Up -or ($Services[$k].Proc -and -not $Services[$k].Proc.HasExited)) { Stop-ScenService $k } else { Start-ScenService $k ($k -ne 'api') }
  })
  $Tips.SetToolTip($toggle, "$($svc.About)`nRuns: npm run $($svc.Script)")

  $open = New-Button 'Open in browser' 130 $C.Panel $C.Ink
  $open.Location = New-Object System.Drawing.Point(96, 140)
  $open.Tag = $key
  $open.Add_Click({ param($sender) Open-Service $sender.Tag })
  $Tips.SetToolTip($open, "Opens $($svc.Url)")

  $card.Controls.AddRange(@($dot, $name, $state, $about, $command, $toggle, $open, $stripe))
  Set-FitText $card
  $Cards.Controls.Add($card)
  $CardUi[$key] = @{ Dot = $dot; State = $state; Toggle = $toggle; Open = $open }
}

# Action rows: a button, what it does in plain words, and the command it runs
$ActionHandlers = @{}
function New-ActionGrid([object[]]$actions) {
  $grid = New-Object System.Windows.Forms.TableLayoutPanel
  $grid.Dock = 'Top'
  $grid.ColumnCount = 2
  $grid.RowCount = [math]::Ceiling($actions.Count / 2)
  $grid.Height = $grid.RowCount * 80
  $grid.Padding = New-Object System.Windows.Forms.Padding(18, 0, 18, 0)
  foreach ($i in 0..1) { $grid.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle('Percent', 50))) | Out-Null }
  foreach ($action in $actions) {
    $row = New-Object System.Windows.Forms.Panel
    $row.Size = New-Object System.Drawing.Size(460, 72)
    $row.Dock = 'Fill'
    $row.Margin = New-Object System.Windows.Forms.Padding(6, 4, 6, 4)
    $row.BackColor = $C.Panel
    $button = New-Button $action.Label 160 $(if ($action.Primary) { $C.Gold } else { $C.Panel2 }) $(if ($action.Primary) { Rgb '#1f1a24' } else { $C.Ink })
    if ($action.Primary) { $button.Font = $FontBold; $button.FlatAppearance.BorderColor = $C.Gold }
    $button.Location = New-Object System.Drawing.Point(12, 10)
    $button.Height = 52
    $button.Tag = $action.Id
    $ActionHandlers[$action.Id] = $action.Run
    $button.Add_Click({ param($sender) & $ActionHandlers[$sender.Tag] })
    $Tips.SetToolTip($button, "$($action.About)`nRuns: $($action.Command)")
    $about = New-Text $action.About $FontSmall $C.Ink 186 8 262 36
    $command = New-Command $action.Command 186 46 262
    $row.Controls.AddRange(@($button, $about, $command))
    Set-FitText $row
    $grid.Controls.Add($row)
  }
  return $grid
}

$PhoneGrid = New-ActionGrid @(
  @{ Id = 'apk-build'; Label = 'Build demo APK'; Primary = $true; Command = 'npm run android:demo'
     About = 'Makes ScenTop-demo.apk, the phone app with built-in perfumes. Needs no internet. Takes 2-5 min.'
     Run = { Start-LauncherJob 'apk-build' } }
  @{ Id = 'apk-install'; Label = 'Install APK on phone'; Primary = $true; Command = 'npm run android:install'
     About = 'Puts ScenTop-demo.apk on a USB phone (USB debugging on) or an open emulator, and opens it.'
     Run = {
       if (-not (Test-Path $DemoApk)) {
         $answer = [System.Windows.Forms.MessageBox]::Show("There is no ScenTop-demo.apk yet. Build it now?`n`nRuns: npm run android:demo", 'ScenTop', 'YesNo', 'Question')
         if ($answer -eq 'Yes') { Start-LauncherJob 'apk-build' }
         return
       }
       Start-LauncherJob 'apk-install'
     } }
  @{ Id = 'apk-folder'; Label = 'Show APK file'; Command = 'explorer /select,ScenTop-demo.apk'
     About = 'Opens the folder with ScenTop-demo.apk selected, to copy it to a phone or send it.'
     Run = {
       if (Test-Path $DemoApk) { Start-Process explorer.exe "/select,`"$DemoApk`"" }
       else { [System.Windows.Forms.MessageBox]::Show('There is no ScenTop-demo.apk yet. Press "Build demo APK" first.', 'ScenTop') | Out-Null }
     } }
)

$SetupGrid = New-ActionGrid @(
  @{ Id = 'demo'; Label = 'Load demo sales data'; Command = 'npm run db:demo'
     About = 'Adds ~85 fake customers and 6 months of orders for the admin charts. Real data is safe.'
     Run = {
       $answer = [System.Windows.Forms.MessageBox]::Show("Add about 85 fake customers and 6 months of orders so the dashboard has something to show?`n`nReal accounts and orders are not touched. Run it again to refresh the dates.`n`nRuns: npm run db:demo", 'Demo data', 'YesNo', 'Question')
       if ($answer -eq 'Yes') { Start-LauncherJob 'demo' }
     } }
  @{ Id = 'demo-clear'; Label = 'Remove demo sales data'; Command = 'npm run db:demo-clear'
     About = 'Deletes only the fake customers and orders added by "Load demo sales data".'
     Run = { Start-LauncherJob 'demo-clear' } }
  @{ Id = 'install'; Label = 'Install packages'; Command = 'npm install'
     About = 'Run once after downloading the project, or when an error says a package is missing.'
     Run = { if (Get-Command npm -ErrorAction SilentlyContinue) { Start-LauncherJob 'install' } else { Assert-Ready | Out-Null } } }
  @{ Id = 'folder'; Label = 'Open project folder'; Command = 'explorer .'
     About = 'Opens the ScenTop project folder in File Explorer.'
     Run = { Start-Process explorer.exe $Root } }
)

# Log
$LogWrap = New-Object System.Windows.Forms.Panel
$LogWrap.Dock = 'Fill'
$LogWrap.Padding = New-Object System.Windows.Forms.Padding(24, 4, 24, 20)
$LogHead = New-Object System.Windows.Forms.Panel
$LogHead.Dock = 'Top'
$LogHead.Height = 26
$LogTitle = New-Object System.Windows.Forms.Label
$LogTitle.Text = 'WHAT IS HAPPENING'
$LogTitle.AutoSize = $true
$LogTitle.Location = New-Object System.Drawing.Point(0, 6)
$LogTitle.ForeColor = $C.Muted
$LogTitle.Font = $FontSection
$TaskLabel = New-Object System.Windows.Forms.Label
$TaskLabel.AutoSize = $true
$TaskLabel.Location = New-Object System.Drawing.Point(150, 5)
$TaskLabel.ForeColor = $C.Green
$LogHead.Controls.AddRange(@($LogTitle, $TaskLabel))
$LogBox = New-Object System.Windows.Forms.RichTextBox
$LogBox.Dock = 'Fill'
$LogBox.ReadOnly = $true
$LogBox.BackColor = (Rgb '#0f0d11')
$LogBox.ForeColor = $C.Ink
$LogBox.BorderStyle = 'None'
$LogBox.Font = $FontMono
$LogBox.DetectUrls = $true
$LogBox.Add_LinkClicked({ param($s, $e) Start-Process $e.LinkText })
$LogWrap.Controls.AddRange(@($LogBox, $LogHead))

# Docked controls are laid out in reverse order of adding
$Form.Controls.AddRange(@(
  $LogWrap,
  $SetupGrid, (New-Section 'DATABASE AND SETUP'),
  $PhoneGrid, (New-Section 'PHONE APP (ANDROID)'),
  $Cards, (New-Section 'RUN THE SHOP ON THIS COMPUTER'),
  $Header
))

# ---- Actions -------------------------------------------------------------------------------------
$StartAll.Add_Click({
  Start-ScenService 'api' $false
  Start-ScenService 'web' $true
  Start-ScenService 'admin' $true
})
$StopAll.Add_Click({ foreach ($k in @('admin', 'web', 'api')) { Stop-ScenService $k } })

# ---- Status loop ---------------------------------------------------------------------------------
$Timer = New-Object System.Windows.Forms.Timer
$Timer.Interval = 700
$Timer.Add_Tick({
  $listening = Get-ListeningPorts
  foreach ($key in $Services.Keys) {
    $svc = $Services[$key]
    $ui = $CardUi[$key]
    Read-NewLog $key
    $running = $svc.Proc -and -not $svc.Proc.HasExited
    if ($svc.Proc -and $svc.Proc.HasExited) {
      Write-Log $key "$($svc.Name) stopped (exit code $($svc.Proc.ExitCode))."
      $svc.Proc = $null
    }
    $svc.Up = $listening -contains $svc.Port
    if ($svc.Up) {
      $ui.Dot.ForeColor = $C.Green
      $ui.State.Text = $(if ($running) { "Running at localhost:$($svc.Port)" } else { "Running at localhost:$($svc.Port) (started elsewhere)" })
      $ui.Toggle.Text = 'Stop'
      if ($svc.OpenWhenReady) { $svc.OpenWhenReady = $false; Open-Service $key }
    } elseif ($running) {
      $ui.Dot.ForeColor = $C.Amber
      $ui.State.Text = 'Starting... (the first start can take a minute)'
      $ui.Toggle.Text = 'Stop'
    } else {
      $ui.Dot.ForeColor = $C.Off
      $ui.State.Text = 'Stopped'
      $ui.Toggle.Text = 'Start'
    }
    $ui.Open.Enabled = $svc.Up
  }

  Read-NewLog 'job'
  if ($script:Task -and $script:Task.HasExited) {
    $ok = $script:Task.ExitCode -eq 0
    Write-Log 'job' $(if ($ok) { "Finished: $script:TaskLabelText" } else { "Failed (exit code $($script:Task.ExitCode)): $script:TaskLabelText. The lines just above say why." })
    $TaskLabel.Text = $(if ($ok) { "Done: $script:TaskLabelText" } else { "Failed: $script:TaskLabelText - see below" })
    $TaskLabel.ForeColor = $(if ($ok) { $C.Green } else { $C.Red })
    $script:Task = $null
    $then = $script:TaskDone
    $script:TaskDone = $null
    if ($then) { & $then }
  }
})

$Form.Add_Shown({
  # Only show what happens from now on, not what earlier sessions left in the log files
  foreach ($name in @($Services.Keys) + 'job') {
    $path = Join-Path $LogDir "$name.log"
    $LogOffsets[$name] = $(if (Test-Path $path) { (Get-Item $path).Length } else { 0 })
  }
  Write-Log 'job' "Project: $Root"
  Write-Log 'job' 'Press "Start everything" to open the shop (http://localhost:4200) and the admin studio (http://localhost:4300).'
  Write-Log 'job' 'Phone app: "Build demo APK", then "Install APK on phone". Demo app login: demo@scentop.app / demo12345'
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
