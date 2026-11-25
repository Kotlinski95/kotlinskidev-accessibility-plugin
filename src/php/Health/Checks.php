<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Health;

use Closure;
use Kotlinskidev\A11y\Admin\SettingsPage;
use Kotlinskidev\A11y\Frontend\Manifest;
use Kotlinskidev\A11y\Frontend\PanelDataStore;
use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Update\Updater;

final class Checks {

	public const GOOD        = 'good';
	public const RECOMMENDED = 'recommended';
	public const CRITICAL    = 'critical';

	public const BUILD_FILES         = 'kotlinskidev_a11y_build_files';
	public const UPDATE_SOURCE       = 'kotlinskidev_a11y_update_source';
	public const OPTIMIZER_CONFLICTS = 'kotlinskidev_a11y_optimizer_conflicts';
	public const PAGE_CACHE_LANGUAGE = 'kotlinskidev_a11y_page_cache_language';
	public const LOCKED_SETTINGS     = 'kotlinskidev_a11y_locked_settings';
	public const PANEL_DATA_STORE    = 'kotlinskidev_a11y_panel_data_store';

	public const UPDATE_STALE_AFTER = 172800;

	private const OPTIMIZERS = array(
		'WP_ROCKET_VERSION'     => array( 'wp-rocket', 'WP Rocket' ),
		'LSCWP_V'               => array( 'litespeed', 'LiteSpeed Cache' ),
		'JETPACK_BOOST_VERSION' => array( 'jetpack-boost', 'Jetpack Boost' ),
		'WPACU_PLUGIN_VERSION'  => array( 'asset-cleanup', 'Asset CleanUp' ),
		'CLOUDFLARE_PLUGIN_DIR' => array( 'cloudflare', 'Cloudflare' ),
	);

	private const ADVISORY_OPTIMIZER = 'AUTOPTIMIZE_PLUGIN_VERSION';

	private readonly Closure $constants;
	private readonly Closure $locales;
	private readonly Closure $now;
	private readonly string $plugin_dir;

	public function __construct(
		private readonly Repository $repository = new Repository(),
		?Closure $constants = null,
		?Closure $locales = null,
		?Closure $now = null,
		?string $plugin_dir = null
	) {
		$this->constants  = $constants ?? static fn ( string $name ): mixed => defined( $name ) ? constant( $name ) : null;
		$this->locales    = $locales ?? static fn (): array => ( new SettingsPage() )->locales();
		$this->now        = $now ?? static fn (): int => time();
		$this->plugin_dir = $plugin_dir ?? KOTLINSKIDEV_A11Y_DIR;
	}

	public function ids(): array {
		return array(
			self::BUILD_FILES,
			self::UPDATE_SOURCE,
			self::OPTIMIZER_CONFLICTS,
			self::PAGE_CACHE_LANGUAGE,
			self::LOCKED_SETTINGS,
			self::PANEL_DATA_STORE,
		);
	}

	public function run( string $id ): ?array {
		return match ( $id ) {
			self::BUILD_FILES         => $this->build_files(),
			self::UPDATE_SOURCE       => $this->update_source(),
			self::OPTIMIZER_CONFLICTS => $this->optimizer_conflicts(),
			self::PAGE_CACHE_LANGUAGE => $this->page_cache_language(),
			self::LOCKED_SETTINGS     => $this->locked_settings(),
			self::PANEL_DATA_STORE    => $this->panel_data_store(),
			default                   => null,
		};
	}

	public function all(): array {
		return array_map( fn ( string $id ): array => (array) $this->run( $id ), $this->ids() );
	}

	public function build_files(): array {
		$missing = kotlinskidev_a11y_missing_files( $this->plugin_dir );

		foreach ( $this->manifest_files() as $file ) {
			if ( ! is_readable( $this->plugin_dir . 'build/' . $file ) ) {
				$missing[] = 'build/' . $file;
			}
		}

		$missing = array_values( array_unique( $missing ) );

		if ( array() === $missing ) {
			return $this->result( self::BUILD_FILES, self::GOOD, __( 'Plugin build files are present', 'kotlinskidev-accessibility' ), __( 'Every script and stylesheet listed in the build manifest exists.', 'kotlinskidev-accessibility' ) );
		}

		return $this->result(
			self::BUILD_FILES,
			self::CRITICAL,
			__( 'Plugin build files are missing', 'kotlinskidev-accessibility' ),
			__( 'The widget cannot load. Missing:', 'kotlinskidev-accessibility' ) . ' ' . implode( ', ', $missing ) . '. ' . __( 'Install kotlinskidev-accessibility.zip from the latest GitHub release, not "Source code (zip)".', 'kotlinskidev-accessibility' ),
			array(
				$this->action( __( 'Open the plugins screen', 'kotlinskidev-accessibility' ), $this->admin_url( 'plugins.php' ) ),
			)
		);
	}

	public function update_source(): array {
		if ( $this->is_subsite() || ! $this->updater_enabled() ) {
			return $this->result( self::UPDATE_SOURCE, self::GOOD, __( 'Plugin updates are not managed here', 'kotlinskidev-accessibility' ), __( 'The updater is disabled or this is a subsite, so no update source is checked.', 'kotlinskidev-accessibility' ) );
		}

		$source   = $this->update_source_data();
		$problems = array();

		if ( 'https' !== $source['scheme'] ) {
			$problems[] = __( 'The update source is not an https address.', 'kotlinskidev-accessibility' );
		}

		$last_check = $this->last_update_check();

		if ( null === $last_check ) {
			$problems[] = __( 'The updater has not checked for updates yet.', 'kotlinskidev-accessibility' );
		} elseif ( ( $this->now )() - $last_check > self::UPDATE_STALE_AFTER ) {
			$problems[] = __( 'The last update check is older than 48 hours.', 'kotlinskidev-accessibility' );
		}

		$host = '' === $source['host'] ? __( 'unknown', 'kotlinskidev-accessibility' ) : $source['host'];

		if ( array() === $problems ) {
			return $this->result( self::UPDATE_SOURCE, self::GOOD, __( 'Plugin updates are reachable', 'kotlinskidev-accessibility' ), __( 'Update source host:', 'kotlinskidev-accessibility' ) . ' ' . $host . '.' );
		}

		return $this->result(
			self::UPDATE_SOURCE,
			self::RECOMMENDED,
			__( 'Plugin updates may not work', 'kotlinskidev-accessibility' ),
			implode( ' ', $problems ) . ' ' . __( 'Update source host:', 'kotlinskidev-accessibility' ) . ' ' . $host . '.',
			array(
				$this->action( __( 'Check for updates', 'kotlinskidev-accessibility' ), $this->admin_url( 'update-core.php' ) ),
			)
		);
	}

	public function optimizer_conflicts(): array {
		$performance = (array) ( $this->repository->get()['performance'] ?? array() );
		$opted_out   = (array) ( $performance['optOut'] ?? array() );
		$compatible  = 'compatibility' === ( $performance['preset'] ?? '' );
		$unresolved  = array();

		foreach ( self::OPTIMIZERS as $constant => $optimizer ) {
			if ( null !== ( $this->constants )( $constant ) && ! $compatible && ! in_array( $optimizer[0], $opted_out, true ) ) {
				$unresolved[] = $optimizer[1];
			}
		}

		$advisory = null !== ( $this->constants )( self::ADVISORY_OPTIMIZER );
		$actions  = array(
			$this->action( __( 'Open the performance settings', 'kotlinskidev-accessibility' ), $this->admin_url( 'options-general.php?page=' . SettingsPage::SLUG ) ),
		);

		if ( array() !== $unresolved ) {
			return $this->result(
				self::OPTIMIZER_CONFLICTS,
				self::RECOMMENDED,
				__( 'A performance plugin may delay the accessibility widget', 'kotlinskidev-accessibility' ),
				__( 'Detected without a matching opt-out:', 'kotlinskidev-accessibility' ) . ' ' . implode( ', ', $unresolved ) . '. ' . __( 'Use the compatibility performance preset, or the custom preset with the matching opt-out.', 'kotlinskidev-accessibility' ),
				$actions
			);
		}

		if ( $advisory ) {
			return $this->result(
				self::OPTIMIZER_CONFLICTS,
				self::RECOMMENDED,
				__( 'Autoptimize may aggregate the accessibility widget scripts', 'kotlinskidev-accessibility' ),
				__( 'Exclude kotlinskidev-accessibility scripts from Autoptimize aggregation.', 'kotlinskidev-accessibility' ),
				$actions
			);
		}

		return $this->result( self::OPTIMIZER_CONFLICTS, self::GOOD, __( 'No performance plugin conflicts found', 'kotlinskidev-accessibility' ), __( 'No known optimizer is active without a matching opt-out.', 'kotlinskidev-accessibility' ) );
	}

	public function page_cache_language(): array {
		$locales = ( $this->locales )();

		if ( count( $locales ) < 2 || ! $this->page_cache_likely() || $this->external_cache_listeners() > 0 ) {
			return $this->result( self::PAGE_CACHE_LANGUAGE, self::GOOD, __( 'Page cache and languages are compatible', 'kotlinskidev-accessibility' ), __( 'The site has one language, no page cache, or a cache that listens for plugin changes.', 'kotlinskidev-accessibility' ) );
		}

		return $this->result(
			self::PAGE_CACHE_LANGUAGE,
			self::RECOMMENDED,
			__( 'Page cache may serve the wrong widget language', 'kotlinskidev-accessibility' ),
			__( 'Several languages and a page cache were detected, and nothing clears the cache when the widget changes. Make the cache vary per language and hook kotlinskidev_a11y_cache_invalidated to purge it.', 'kotlinskidev-accessibility' )
		);
	}

	public function locked_settings(): array {
		$errors = $this->repository->lock_errors();

		if ( array() === $errors ) {
			return $this->result( self::LOCKED_SETTINGS, self::GOOD, __( 'Settings locks are valid', 'kotlinskidev-accessibility' ), __( 'Every settings lock passes the schema.', 'kotlinskidev-accessibility' ) );
		}

		$entries = array();

		foreach ( $errors as $path => $reason ) {
			$entries[] = $path . ' (' . $reason . ')';
		}

		return $this->result(
			self::LOCKED_SETTINGS,
			self::RECOMMENDED,
			__( 'Some settings locks were ignored', 'kotlinskidev-accessibility' ),
			__( 'Invalid locks:', 'kotlinskidev-accessibility' ) . ' ' . implode( ', ', $entries ) . '.'
		);
	}

	public function panel_data_store(): array {
		$uploads = wp_upload_dir();
		$base    = is_array( $uploads ) && empty( $uploads['error'] ) && is_string( $uploads['basedir'] ?? null ) ? $uploads['basedir'] : '';
		$folder  = '' === $base ? '' : trailingslashit( $base ) . PanelDataStore::DIRECTORY;
		$usable  = '' !== $folder && ( is_dir( $folder ) ? wp_is_writable( $folder ) : wp_is_writable( $base ) );

		if ( $usable ) {
			return $this->result( self::PANEL_DATA_STORE, self::GOOD, __( 'Panel data folder is writable', 'kotlinskidev-accessibility' ), __( 'Panel data is served as static files.', 'kotlinskidev-accessibility' ) );
		}

		return $this->result(
			self::PANEL_DATA_STORE,
			self::RECOMMENDED,
			__( 'Panel data folder is not writable', 'kotlinskidev-accessibility' ),
			__( 'The uploads folder kotlinskidev-a11y cannot be written, so panel data falls back to the REST API.', 'kotlinskidev-accessibility' )
		);
	}

	public function updater_enabled(): bool {
		if ( true === ( $this->constants )( 'KOTLINSKIDEV_A11Y_DISABLE_UPDATER' ) ) {
			return false;
		}

		return (bool) apply_filters( 'kotlinskidev_a11y_enable_updater', true );
	}

	public function update_source_data(): array {
		$repository = ( new Updater( $this->plugin_dir ) )->source()['repository'];
		$parts      = wp_parse_url( $repository );

		return array(
			'scheme' => is_array( $parts ) ? (string) ( $parts['scheme'] ?? '' ) : '',
			'host'   => is_array( $parts ) ? (string) ( $parts['host'] ?? '' ) : '',
		);
	}

	private function last_update_check(): ?int {
		$slug  = ( new Updater( $this->plugin_dir ) )->source()['slug'];
		$state = get_site_option( 'external_updates-' . $slug, null );
		$last  = is_object( $state ) || is_array( $state ) ? ( (array) $state )['lastCheck'] ?? 0 : 0;

		return is_numeric( $last ) && (int) $last > 0 ? (int) $last : null;
	}

	private function manifest_files(): array {
		$files = array();

		foreach ( (array) ( Manifest::data() ) as $group ) {
			if ( ! is_array( $group ) ) {
				continue;
			}

			foreach ( $group as $entry ) {
				if ( is_array( $entry ) && is_string( $entry['file'] ?? null ) ) {
					$files[] = $entry['file'];
				}
			}
		}

		return $files;
	}

	private function page_cache_likely(): bool {
		return true === ( $this->constants )( 'WP_CACHE' ) || is_readable( (string) ( $this->constants )( 'WP_CONTENT_DIR' ) . '/advanced-cache.php' );
	}

	private function external_cache_listeners(): int {
		global $wp_filter;

		$hook = $wp_filter['kotlinskidev_a11y_cache_invalidated'] ?? null;

		if ( ! is_object( $hook ) || ! isset( $hook->callbacks ) || ! is_array( $hook->callbacks ) ) {
			return 0;
		}

		$count = 0;

		foreach ( $hook->callbacks as $callbacks ) {
			foreach ( (array) $callbacks as $callback ) {
				$function = $callback['function'] ?? null;
				$owned    = is_array( $function ) && $function[0] instanceof PanelDataStore;

				if ( ! $owned ) {
					++$count;
				}
			}
		}

		return $count;
	}

	private function is_subsite(): bool {
		return is_multisite() && ! is_main_site();
	}

	private function admin_url( string $path ): string {
		return admin_url( $path );
	}

	private function action( string $label, string $url ): array {
		return array(
			'label' => $label,
			'url'   => $url,
		);
	}

	private function result( string $id, string $status, string $label, string $description, array $actions = array() ): array {
		return array(
			'id'          => $id,
			'status'      => $status,
			'label'       => $label,
			'description' => $description,
			'actions'     => $actions,
		);
	}
}
