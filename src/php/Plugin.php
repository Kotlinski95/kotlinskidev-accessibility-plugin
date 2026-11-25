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
		( new Cache\VersionWatcher() )->register();
		( new Frontend\PanelDataStore() )->register();

		$counter = new Admin\AltTextCounter();

		$counter->register();
		add_action( 'rest_api_init', array( new Rest\SettingsController(), 'register_routes' ) );
		add_action( 'rest_api_init', array( new Rest\AltTextController( $counter ), 'register_routes' ) );
		add_action( 'rest_api_init', array( new Rest\PanelDataController(), 'register_routes' ) );
		( new Statement\Shortcode() )->register();

		$visibility = new Frontend\Visibility();

		( new Frontend\ScriptAttributes() )->register();
		( new Frontend\Assets( $visibility ) )->register();
		( new Frontend\Markup( $visibility ) )->register();

		if ( is_admin() ) {
			( new Admin\SettingsPage() )->register();
			( new Admin\AltTextPage() )->register();
			( new Admin\DashboardWidget( $counter ) )->register();
			( new Admin\PerformanceNotice() )->register();
		}

		if ( self::should_check_updates() ) {
			( new Update\Updater( KOTLINSKIDEV_A11Y_FILE ) )->register();
		}
	}

	public static function should_check_updates(): bool {
		return is_admin() || wp_doing_cron();
	}
}
