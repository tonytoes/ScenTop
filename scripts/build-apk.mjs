// Builds a debug APK you can install on a phone: android/app/build/outputs/apk/debug/app-debug.apk
// Run it with `npm run android:apk` (this also rebuilds the website and syncs it into the Android project).
// `--copy-to <file>` also copies the finished APK there (npm run android:demo uses it for ScenTop-demo.apk).
//
// Android builds need a JDK (17 to 21) and the Android SDK. This script looks for them in the usual
// places so you do not have to set environment variables by hand.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const isWindows = process.platform === 'win32';
const home = homedir();

function firstExisting(paths) {
  return paths.find((path) => path && existsSync(path));
}

function findJdk() {
  const gradleJdks = join(home, '.gradle', 'jdks');
  const downloaded = existsSync(gradleJdks) ? readdirSync(gradleJdks).map((name) => join(gradleJdks, name)) : [];
  return firstExisting([
    process.env.JAVA_HOME,
    isWindows ? 'C:\\Program Files\\Android\\Android Studio\\jbr' : undefined,
    process.platform === 'darwin' ? '/Applications/Android Studio.app/Contents/jbr/Contents/Home' : undefined,
    ...downloaded.filter((path) => existsSync(join(path, 'bin'))),
  ]);
}

function findSdk() {
  return firstExisting([
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    isWindows ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk') : undefined,
    process.platform === 'darwin' ? join(home, 'Library', 'Android', 'sdk') : undefined,
    join(home, 'Android', 'Sdk'),
  ]);
}

const jdk = findJdk();
const sdk = findSdk();

if (!sdk) {
  console.error('Could not find the Android SDK. Install Android Studio, or set the ANDROID_HOME environment variable.');
  process.exit(1);
}
if (!jdk) {
  console.error('Could not find a JDK. Install Android Studio (it includes one), or set JAVA_HOME to a JDK 17 or 21.');
  process.exit(1);
}

const androidDir = join(process.cwd(), 'android');
if (!existsSync(androidDir)) {
  console.error('There is no android/ folder. Run "npx cap add android" first.');
  process.exit(1);
}

// Gradle reads the SDK location from local.properties (it is different on every computer, so it is not in git)
const localProperties = join(androidDir, 'local.properties');
if (!existsSync(localProperties)) writeFileSync(localProperties, `sdk.dir=${sdk.replaceAll('\\', '/')}\n`);

console.log(`Using JDK:  ${jdk}\nUsing SDK:  ${sdk}\n`);

const gradle = join(androidDir, isWindows ? 'gradlew.bat' : 'gradlew');
// .bat files must be started through cmd.exe on Windows
const [command, args] = isWindows ? ['cmd.exe', ['/c', gradle, 'assembleDebug', '--console=plain']] : [gradle, ['assembleDebug', '--console=plain']];
const result = spawnSync(command, args, {
  cwd: androidDir,
  stdio: 'inherit',
  env: { ...process.env, JAVA_HOME: jdk, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk },
});

if (result.status !== 0) process.exit(result.status ?? 1);
const apk = 'android/app/build/outputs/apk/debug/app-debug.apk';
const copyTo = process.argv.includes('--copy-to') ? process.argv[process.argv.indexOf('--copy-to') + 1] : undefined;
if (copyTo) {
  copyFileSync(apk, copyTo);
  console.log(`\nDone: ${copyTo} (also in ${apk})`);
} else {
  console.log(`\nDone: ${apk}`);
}
