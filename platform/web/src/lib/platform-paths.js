import path from 'node:path';

export const ROOT_DIR = process.cwd();

export const APPS_DIR = path.join(ROOT_DIR, 'apps');
export const APP_PACKAGE_DEFINITIONS_DIR = path.join(APPS_DIR, 'packages');
export const APP_ZIPS_DIR = path.join(APPS_DIR, 'zips');

export const RUNTIME_DIR = path.join(ROOT_DIR, 'runtime');
export const RUNTIME_DATA_DIR = path.join(RUNTIME_DIR, 'data');
export const RUNTIME_HOSTED_APPS_DIR = path.join(RUNTIME_DIR, 'hosted-apps');
export const RUNTIME_APP_DOWNLOADS_DIR = path.join(RUNTIME_DIR, 'downloads');
