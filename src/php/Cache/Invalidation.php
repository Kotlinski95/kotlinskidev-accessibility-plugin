<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Cache;

final class Invalidation {

	private static bool $settings_fired = false;

	public static function settings_changed(): void {
		if ( self::$settings_fired ) {
			return;
		}

		self::$settings_fired = true;

		do_action( 'kotlinskidev_a11y_cache_invalidated', 'settings' );
	}

	public static function reset_request_state(): void {
		self::$settings_fired = false;
	}
}
