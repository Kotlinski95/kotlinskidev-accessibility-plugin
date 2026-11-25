<?php
if (!defined('ABSPATH') || !defined('KOTLINSKIDEV_A11Y_E2E') || !defined('WP_ENVIRONMENT_TYPE') || 'local' !== WP_ENVIRONMENT_TYPE) {
	return;
}

$ka11y_csp_mode = isset($_COOKIE['ka11y_fixture_csp']) ? (string) $_COOKIE['ka11y_fixture_csp'] : '';

if (!in_array($ka11y_csp_mode, array('nonce', 'strict'), true)) {
	return;
}

$ka11y_csp_nonce = bin2hex(random_bytes(16));

add_action(
	'template_redirect',
	static function () use ($ka11y_csp_mode, $ka11y_csp_nonce) {
		$script = 'strict' === $ka11y_csp_mode
			? "script-src 'nonce-{$ka11y_csp_nonce}' 'strict-dynamic'"
			: "script-src 'nonce-{$ka11y_csp_nonce}'";

		header(
			'Content-Security-Policy: ' . $script . "; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'"
		);
	},
	0
);

$ka11y_csp_add_nonce = static function ($attributes) use ($ka11y_csp_nonce) {
	if (!is_array($attributes)) {
		return $attributes;
	}

	$attributes['nonce'] = $ka11y_csp_nonce;

	return $attributes;
};

add_filter('wp_script_attributes', $ka11y_csp_add_nonce, 99);
add_filter('wp_inline_script_attributes', $ka11y_csp_add_nonce, 99);

add_action(
	'template_redirect',
	static function () use ($ka11y_csp_nonce) {
		ob_start(
			static function ($html) use ($ka11y_csp_nonce) {
				return preg_replace(
					'/<link\b(?![^>]*\bnonce=)([^>]*\brel=["\']modulepreload["\'][^>]*\/wp-includes\/[^>]*)>/i',
					'<link nonce="' . $ka11y_csp_nonce . '"$1>',
					$html
				);
			}
		);
	},
	1
);

add_action(
	'init',
	static function () {
		remove_action('wp_head', 'print_emoji_detection_script', 7);
	}
);
