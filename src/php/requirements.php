<?php
declare(strict_types=1);

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function kotlinskidev_a11y_required_files(): array {
	return array( 'vendor/autoload.php', 'build/loader.js', 'build/bootstrap.js', 'build/launcher.css', 'build/manifest.php' );
}

function kotlinskidev_a11y_missing_files( string $plugin_dir ): array {
	return array_values(
		array_filter(
			kotlinskidev_a11y_required_files(),
			static fn ( string $file ): bool => ! is_readable( $plugin_dir . $file )
		)
	);
}

function kotlinskidev_a11y_render_incomplete_notice(): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	printf(
		'<div class="notice notice-error"><p>%s</p></div>',
		esc_html__(
			'Kotlinskidev Accessibility is inactive because some plugin files are missing. Delete it, then install kotlinskidev-accessibility.zip from the latest GitHub release, not "Source code (zip)".',
			'kotlinskidev-accessibility'
		)
	);
}

function kotlinskidev_a11y_requirements_met( string $plugin_dir ): bool {
	if ( array() === kotlinskidev_a11y_missing_files( $plugin_dir ) ) {
		return true;
	}

	add_action( 'admin_notices', 'kotlinskidev_a11y_render_incomplete_notice' );

	return false;
}
