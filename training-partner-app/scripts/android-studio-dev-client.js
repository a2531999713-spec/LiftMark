#!/usr/bin/env node

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_NAME = 'com.liftmark.app';
const METRO_PORT = process.env.LIFTMARK_METRO_PORT || '8081';
const DEV_SERVER_URL =
  process.env.LIFTMARK_DEV_CLIENT_URL || `http://localhost:${METRO_PORT}`;
const PREFS_FILE = `${PACKAGE_NAME}_preferences.xml`;
const DEVICE_PREFS_PATH = `shared_prefs/${PREFS_FILE}`;
const DEVICE_TEMP_PREFS = '/data/local/tmp/liftmark_rn_debug_prefs.xml';
const DEEP_LINK = `liftmark://expo-development-client/?url=${encodeURIComponent(
  DEV_SERVER_URL,
)}`;

function run(command, args, options = {}) {
  const label = [command, ...args].join(' ');
  console.log(`> ${label}`);
  execFileSync(command, args, { stdio: 'inherit', ...options });
}

function tryRun(command, args) {
  try {
    run(command, args);
    return true;
  } catch (_error) {
    return false;
  }
}

function writeDebugHostPreferences() {
  const xml = [
    "<?xml version='1.0' encoding='utf-8' standalone='yes' ?>",
    '<map>',
    `    <string name="debug_http_host">localhost:${METRO_PORT}</string>`,
    '</map>',
    '',
  ].join('\n');
  const localPrefsPath = path.join(os.tmpdir(), 'liftmark_rn_debug_prefs.xml');

  fs.writeFileSync(localPrefsPath, xml, { encoding: 'utf8' });
  run('adb', ['push', localPrefsPath, DEVICE_TEMP_PREFS]);

  if (!tryRun('adb', ['shell', 'run-as', PACKAGE_NAME, 'mkdir', '-p', 'shared_prefs'])) {
    throw new Error(
      [
        'Unable to access app debug data with run-as.',
        'Open android/ in Android Studio, select the debug build variant, then run the app once before retrying.',
      ].join(' '),
    );
  }

  run('adb', ['shell', 'run-as', PACKAGE_NAME, 'cp', DEVICE_TEMP_PREFS, DEVICE_PREFS_PATH]);
}

function main() {
  console.log('Preparing LiftMark Android Studio dev-client launch...');
  console.log(`Metro URL: ${DEV_SERVER_URL}`);

  run('adb', ['reverse', `tcp:${METRO_PORT}`, `tcp:${METRO_PORT}`]);
  writeDebugHostPreferences();
  run('adb', [
    'shell',
    'am',
    'start',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    DEEP_LINK,
    PACKAGE_NAME,
  ]);

  console.log('Dev client launch requested.');
}

main();
