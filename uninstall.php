<?php
declare(strict_types=1);

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

if ( ! function_exists( 'kotlinskidev_a11y_uninstall_folder' ) ) {
	function kotlinskidev_a11y_uninstall_folder( string $folder ): void {
		if ( ! function_exists( 'get_filesystem_method' ) || ! function_exists( 'WP_Filesystem' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}

		if ( 'direct' === get_filesystem_method() && WP_Filesystem() ) {
			global $wp_filesystem;

			if ( $wp_filesystem instanceof WP_Filesystem_Base ) {
				if ( $wp_filesystem->is_dir( $folder ) ) {
					$wp_filesystem->rmdir( $folder, true );
				}

				return;
			}
		}

		$files = glob( $folder . '/*' );

		foreach ( false === $files ? array() : $files as $file ) {
			wp_delete_file( $file );
		}
	}

	function kotlinskidev_a11y_uninstall_site(): void {
		delete_option( 'kotlinskidev_a11y_settings' );
		delete_option( 'kotlinskidev_a11y_installed_version' );
		delete_transient( 'kotlinskidev_a11y_missing_alt' );
		delete_option( 'kotlinskidev_a11y_panel_data' );

		$uploads = wp_upload_dir();

		if ( empty( $uploads['error'] ) && is_string( $uploads['basedir'] ?? null ) ) {
			kotlinskidev_a11y_uninstall_folder( trailingslashit( $uploads['basedir'] ) . 'kotlinskidev-a11y' );
		}
	}

	function kotlinskidev_a11y_uninstall(): void {
		if ( ! is_multisite() ) {
			kotlinskidev_a11y_uninstall_site();

			return;
		}

		$site_ids = get_sites(
			array(
				'fields' => 'ids',
				'number' => 0,
			)
		);

		foreach ( $site_ids as $site_id ) {
			switch_to_blog( (int) $site_id );
			kotlinskidev_a11y_uninstall_site();
			restore_current_blog();
		}
	}
}

kotlinskidev_a11y_uninstall();
