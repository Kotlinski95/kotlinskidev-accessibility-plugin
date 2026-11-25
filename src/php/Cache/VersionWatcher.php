<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Cache;

use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Support\Json;

final class VersionWatcher {

	public const OPTION        = 'kotlinskidev_a11y_installed_version';
	public const LAYERS_OPTION = 'kotlinskidev_a11y_layers_hash';

	private Repository $repository;

	public function __construct( ?Repository $repository = null ) {
		$this->repository = $repository ?? new Repository();
	}

	public function register(): void {
		if ( is_admin() || wp_doing_cron() ) {
			$this->check();
		}
	}

	public function check(): void {
		$this->check_version();
		$this->check_layers();
	}

	private function check_layers(): void {
		$hash  = md5( Json::encode( array( $this->repository->effective_defaults(), $this->repository->locked() ) ) );
		$known = get_option( self::LAYERS_OPTION, null );

		if ( $known === $hash ) {
			return;
		}

		update_option( self::LAYERS_OPTION, $hash );

		if ( is_string( $known ) ) {
			Invalidation::settings_changed();
		}
	}

	private function check_version(): void {
		$stored = get_option( self::OPTION, '' );

		if ( KOTLINSKIDEV_A11Y_VERSION === $stored ) {
			return;
		}

		update_option( self::OPTION, KOTLINSKIDEV_A11Y_VERSION );
		$this->repository->persist_migrated();

		if ( is_string( $stored ) && '' !== $stored ) {
			do_action( 'kotlinskidev_a11y_cache_invalidated', 'update' );
		}
	}
}
