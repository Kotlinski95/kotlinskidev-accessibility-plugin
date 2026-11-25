<?php
if ( ! defined( 'ABSPATH' ) || ! defined( 'WP_ENVIRONMENT_TYPE' ) || 'local' !== WP_ENVIRONMENT_TYPE ) {
	return;
}

if ( ! defined( 'KOTLINSKIDEV_A11Y_E2E' ) || ! KOTLINSKIDEV_A11Y_E2E ) {
	return;
}

$ka11y_fixture_locale = isset( $_COOKIE['ka11y_fixture_locale'] ) ? (string) $_COOKIE['ka11y_fixture_locale'] : '';

if ( 1 !== preg_match( '/^[a-z]{2,3}_[A-Z]{2}$/', $ka11y_fixture_locale ) ) {
	return;
}

add_filter(
	'kotlinskidev_a11y_current_locale',
	static function () use ( $ka11y_fixture_locale ): string {
		return $ka11y_fixture_locale;
	}
);

add_filter(
	'kotlinskidev_a11y_known_locales',
	static function ( $locales ): array {
		return array_values( array_unique( array_merge( is_array( $locales ) ? $locales : array(), array( 'en_US', 'pl_PL', 'he_IL' ) ) ) );
	}
);

add_filter(
	'get_available_languages',
	static function ( $languages ): array {
		return array_values( array_unique( array_merge( is_array( $languages ) ? $languages : array(), array( 'pl_PL', 'he_IL' ) ) ) );
	}
);

add_filter(
	'kotlinskidev_a11y_locale_label',
	static function ( string $label, string $locale ): string {
		$labels = array(
			'en_US' => 'English',
			'pl_PL' => 'Polski',
			'he_IL' => 'עברית',
		);

		return $labels[ $locale ] ?? $label;
	},
	10,
	2
);
