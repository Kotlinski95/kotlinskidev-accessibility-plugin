<?php
if (!defined('ABSPATH') || !defined('WP_ENVIRONMENT_TYPE') || 'local' !== WP_ENVIRONMENT_TYPE) {
	return;
}

if (!isset($_COOKIE['ka11y_fixture']) || 'hostile' !== $_COOKIE['ka11y_fixture']) {
	return;
}

if (!is_dir(WP_CONTENT_DIR . '/themes/ka11y-hostile')) {
	return;
}

add_filter('pre_option_template', static fn () => 'ka11y-hostile');
add_filter('pre_option_stylesheet', static fn () => 'ka11y-hostile');
