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
		load_plugin_textdomain( 'kotlinskidev-accessibility', false, dirname( plugin_basename( KOTLINSKIDEV_A11Y_FILE ) ) . '/languages' );

		( new Frontend\PanelDataStore() )->register();
		( new Cache\VersionWatcher() )->register();

		$counter = new Admin\AltTextCounter();

		$counter->register();
		add_action( 'rest_api_init', array( new Rest\SettingsController(), 'register_routes' ) );
		add_action( 'rest_api_init', array( new Rest\NetworkSettingsController(), 'register_routes' ) );
		add_action( 'rest_api_init', array( new Rest\AltTextController( $counter ), 'register_routes' ) );
		add_action( 'rest_api_init', array( new Rest\PanelDataController(), 'register_routes' ) );
		add_action( 'rest_api_init', array( new Rest\TriggerOptionsController(), 'register_routes' ) );
		self::register_update_tools();
		( new Statement\Shortcode() )->register();
		( new Triggers\ButtonShortcode() )->register();
		( new Triggers\Block() )->register();

		$visibility = new Frontend\Visibility();

		( new Frontend\ScriptAttributes() )->register();
		( new Frontend\Assets( $visibility ) )->register();
		( new Frontend\Markup( $visibility ) )->register();

		if ( is_admin() ) {
			( new Admin\SettingsPage() )->register();
			( new Admin\NetworkSettingsPage() )->register();
			( new Admin\AltTextPage() )->register();
			( new Admin\DashboardWidget( $counter ) )->register();
			( new Admin\PerformanceNotice() )->register();
			( new Admin\UnverifiedPackageNotice() )->register();
			( new Privacy\PolicyText() )->register();
		}

		if ( is_admin() || wp_doing_cron() ) {
			( new Health\SiteHealth() )->register();
		}

		if ( self::should_check_updates() ) {
			( new Update\Updater( KOTLINSKIDEV_A11Y_FILE ) )->register();
		}

		if ( defined( 'WP_CLI' ) && true === constant( 'WP_CLI' ) ) {
			Cli\SettingsCommand::register();
			Cli\DoctorCommand::register();
			Cli\AccessCommand::register();
		}
	}

	private static function register_update_tools(): void {
		$updater = new Update\Updater( KOTLINSKIDEV_A11Y_FILE );

		if ( ! $updater->enabled() ) {
			return;
		}

		$channel  = new Update\Channel();
		$rollback = new Update\Rollback( $updater, $channel, KOTLINSKIDEV_A11Y_VERSION );

		add_action( 'rest_api_init', array( new Rest\UpdateController( $updater, $channel, $rollback ), 'register_routes' ) );

		if ( is_admin() ) {
			( new Admin\RollbackPage( $rollback ) )->register();
		}

		if ( self::should_check_updates() ) {
			( new Update\PackageVerifier( $updater, plugin_basename( KOTLINSKIDEV_A11Y_FILE ) ) )->register();
		}
	}

	public static function should_check_updates(): bool {
		return is_admin() || wp_doing_cron() || ( defined( 'WP_CLI' ) && true === constant( 'WP_CLI' ) );
	}
}
