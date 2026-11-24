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
		add_action( 'rest_api_init', array( new Rest\SettingsController(), 'register_routes' ) );

		$visibility = new Frontend\Visibility();

		( new Frontend\Assets( $visibility ) )->register();
		( new Frontend\Markup( $visibility ) )->register();

		if ( is_admin() ) {
			( new Admin\SettingsPage() )->register();
		}
	}
}
