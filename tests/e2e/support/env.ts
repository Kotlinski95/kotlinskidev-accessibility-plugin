import { resolve } from 'node:path';

export const BASE_URL = process.env.WP_BASE_URL ?? 'http://localhost:8889';
export const ADMIN_USER = 'admin';
export const ADMIN_PASSWORD = 'password';
export const AUTH_FILE = resolve(__dirname, '..', '.auth', 'admin.json');
export const SETTINGS_PAGE = '/wp-admin/options-general.php?page=kotlinskidev-accessibility';
export const OPEN_HASH = '#kotlinskidev-a11y';
export const REST_NAMESPACE = 'kotlinskidev-a11y/v1';
