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

	function kotlinskidev_a11y_uninstall_keeps_data(): bool {
		$settings    = get_option( 'kotlinskidev_a11y_settings', array() );
		$maintenance = is_array( $settings ) ? ( $settings['maintenance'] ?? null ) : null;

		return is_array( $maintenance ) && true === ( $maintenance['keepDataOnUninstall'] ?? false );
	}

	function kotlinskidev_a11y_uninstall_capabilities(): array {
		$default  = 'kotlinskidev_a11y_customize';
		$prefix   = 'kotlinskidev_a11y_';
		$filtered = apply_filters( 'kotlinskidev_a11y_customer_capability', $default );
		$names    = array( $default );

		if ( is_string( $filtered ) && strlen( $filtered ) > strlen( $prefix ) && str_starts_with( $filtered, $prefix ) ) {
			$names[] = $filtered;
		}

		return array_values( array_unique( $names ) );
	}

	function kotlinskidev_a11y_uninstall_site(): void {
		foreach ( array( 'settings', 'installed_version', 'settings_backup', 'layers_hash', 'panel_data', 'update', 'unverified_package' ) as $name ) {
			delete_option( 'kotlinskidev_a11y_' . $name );
		}

		delete_transient( 'kotlinskidev_a11y_missing_alt' );
		delete_transient( 'kotlinskidev_a11y_releases' );

		$capabilities = kotlinskidev_a11y_uninstall_capabilities();

		foreach ( wp_roles()->role_objects as $role ) {
			foreach ( $capabilities as $capability ) {
				$role->remove_cap( $capability );
			}
		}

		$uploads = wp_upload_dir();

		if ( empty( $uploads['error'] ) && is_string( $uploads['basedir'] ?? null ) ) {
			kotlinskidev_a11y_uninstall_folder( trailingslashit( $uploads['basedir'] ) . 'kotlinskidev-a11y' );
		}
	}

	function kotlinskidev_a11y_uninstall_network(): void {
		delete_site_option( 'kotlinskidev_a11y_network_settings' );
		delete_site_option( 'kotlinskidev_a11y_update' );
		delete_site_option( 'kotlinskidev_a11y_unverified_package' );
		delete_site_option( 'external_updates-kotlinskidev-accessibility' );
		delete_site_transient( 'kotlinskidev_a11y_releases' );
		delete_metadata( 'user', 0, 'kotlinskidev_a11y_perf_notice_dismissed', '', true );
	}

	function kotlinskidev_a11y_uninstall(): void {
		if ( ! is_multisite() ) {
			if ( kotlinskidev_a11y_uninstall_keeps_data() ) {
				return;
			}

			kotlinskidev_a11y_uninstall_site();
			kotlinskidev_a11y_uninstall_network();

			return;
		}

		$site_ids  = get_sites(
			array(
				'fields' => 'ids',
				'number' => 0,
			)
		);
		$main_id   = (int) get_main_site_id();
		$main_kept = false;

		foreach ( $site_ids as $site_id ) {
			switch_to_blog( (int) $site_id );

			if ( kotlinskidev_a11y_uninstall_keeps_data() ) {
				$main_kept = $main_kept || (int) $site_id === $main_id;
			} else {
				kotlinskidev_a11y_uninstall_site();
			}

			restore_current_blog();
		}

		if ( ! $main_kept ) {
			kotlinskidev_a11y_uninstall_network();
		}
	}
}

kotlinskidev_a11y_uninstall();
