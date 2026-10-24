// Installs the app on a phone or emulator plugged into this computer, then opens it.
// `npm run android:install` installs ScenTop-demo.apk (build it with `npm run android:demo`);
// `npm run android:install -- some/other.apk` installs another APK.
//
// On a real phone: turn on Developer options > USB debugging, plug it in and allow this computer when asked.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const isWindows = process.platform === 'win32';
const apk = process.argv[2] ?? 'ScenTop-demo.apk';

if (!existsSync(apk)) {
  console.error(`${apk} does not exist yet. Build it first with "npm run android:demo".`);
  process.exit(1);
}

const sdk = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  isWindows ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk') : undefined,
  process.platform === 'darwin' ? join(homedir(), 'Library', 'Android', 'sdk') : undefined,
  join(homedir(), 'Android', 'Sdk'),
].find((path) => path && existsSync(path));
const adb = sdk ? join(sdk, 'platform-tools', isWindows ? 'adb.exe' : 'adb') : undefined;
if (!adb || !existsSync(adb)) {
  console.error('Could not find adb. Install Android Studio (it includes the Android SDK platform-tools).');
  process.exit(1);
}

const run = (...args) => spawnSync(adb, args, { encoding: 'utf8' });

const devices = run('devices').stdout.split('\n').slice(1).map((line) => line.trim().split(/\s+/)).filter(([id]) => id);
const ready = devices.filter(([, state]) => state === 'device');
if (devices.some(([, state]) => state === 'unauthorized')) {
  console.error('Your phone is asking to allow USB debugging. Tap "Allow" on the phone, then try again.');
  process.exit(1);
}
if (ready.length === 0) {
  console.error('No phone or emulator found. Plug in a phone with USB debugging turned on, or start an emulator from Android Studio.');
  process.exit(1);
}
if (ready.length > 1) console.log(`Several devices found, installing on ${ready[0][0]}.`);

const serial = ready[0][0];
console.log(`Installing ${apk} on ${serial}...`);
const install = spawnSync(adb, ['-s', serial, 'install', '-r', apk], { stdio: 'inherit' });
if (install.status !== 0) process.exit(install.status ?? 1);

run('-s', serial, 'shell', 'monkey', '-p', 'com.scentop.app', '-c', 'android.intent.category.LAUNCHER', '1');
console.log('Done: ScenTop is installed and opening on the device.');
