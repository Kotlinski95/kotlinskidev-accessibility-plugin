<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Cache;

final class VersionWatcher {

	public const OPTION = 'kotlinskidev_a11y_installed_version';

	public function register(): void {
		if ( is_admin() || wp_doing_cron() ) {
			$this->check();
		}
	}

	public function check(): void {
		$stored = get_option( self::OPTION, '' );

		if ( KOTLINSKIDEV_A11Y_VERSION === $stored ) {
			return;
		}

		update_option( self::OPTION, KOTLINSKIDEV_A11Y_VERSION );

		if ( is_string( $stored ) && '' !== $stored ) {
			do_action( 'kotlinskidev_a11y_cache_invalidated', 'update' );
		}
	}
}
