<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y;

final class Plugin {

	private static bool $booted = false;

	public static function boot(): void {
		if ( self::$booted ) {
			return;
		}

		self::$booted = true;

		add_action( 'plugins_loaded', array( self::class, 'init' ) );
	}

	public static function init(): void {
	}
}
