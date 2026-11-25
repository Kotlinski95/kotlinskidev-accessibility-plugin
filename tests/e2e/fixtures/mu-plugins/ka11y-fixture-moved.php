<?php
if (!defined('ABSPATH') || !defined('KOTLINSKIDEV_A11Y_E2E') || !defined('WP_ENVIRONMENT_TYPE') || 'local' !== WP_ENVIRONMENT_TYPE) {
	return;
}

if (!isset($_COOKIE['ka11y_fixture_moved']) || '1' !== $_COOKIE['ka11y_fixture_moved']) {
	return;
}

add_filter(
	'script_loader_src',
	static function ($src, $handle) {
		if ('kotlinskidev-a11y-loader' !== $handle || !defined('KOTLINSKIDEV_A11Y_DIR') || !class_exists('Kotlinskidev\A11y\Frontend\Manifest')) {
			return $src;
		}

		$entry = Kotlinskidev\A11y\Frontend\Manifest::script('loader');
		$from  = KOTLINSKIDEV_A11Y_DIR . 'build/' . $entry['file'];
		$dir   = WP_CONTENT_DIR . '/cache/asset-cleanup/js';
		$to    = $dir . '/ka11y-loader.js';

		if (!is_readable($from) || (!is_dir($dir) && !wp_mkdir_p($dir))) {
			return $src;
		}

		if (!is_file($to) || filemtime($to) < filemtime($from) || filesize($to) !== filesize($from)) {
			$tmp = $to . '.' . bin2hex(random_bytes(4)) . '.tmp';

			if (!copy($from, $tmp)) {
				return $src;
			}

			if (!rename($tmp, $to)) {
				unlink($tmp);

				return $src;
			}
		}

		return WP_CONTENT_URL . '/cache/asset-cleanup/js/ka11y-loader.js?ver=' . rawurlencode((string) $entry['ver']);
	},
	10,
	2
);
