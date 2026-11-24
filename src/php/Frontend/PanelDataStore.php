<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Frontend;

use Kotlinskidev\A11y\Rest\PanelDataController;
use Kotlinskidev\A11y\Settings\Sanitizer;
use WP_Filesystem_Base;

final class PanelDataStore {

	public const OPTION       = 'kotlinskidev_a11y_panel_data';
	public const DIRECTORY    = 'kotlinskidev-a11y';
	private const RETRY_AFTER = 3600;

	private PanelData $panel_data;

	public function __construct( ?PanelData $panel_data = null ) {
		$this->panel_data = $panel_data ?? new PanelData();
	}

	public function register(): void {
		add_action( 'kotlinskidev_a11y_cache_invalidated', array( $this, 'invalidate' ) );
		add_action( 'upgrader_process_complete', array( $this, 'on_upgrade' ), 10, 2 );
	}

	public function on_upgrade( mixed $upgrader, mixed $options ): void {
		if ( is_array( $options ) && 'translation' === ( $options['type'] ?? '' ) ) {
			do_action( 'kotlinskidev_a11y_cache_invalidated', 'translations' );
		}
	}

	public function entry( string $locale ): array {
		$entries = $this->entries();
		$cached  = $entries[ $locale ] ?? null;

		if ( $this->is_well_formed( $cached ) && ! $this->should_retry( $locale, $cached ) ) {
			return $cached;
		}

		$entries[ $locale ] = $this->build( $locale, $this->is_well_formed( $cached ) ? $cached : null );

		update_option( self::OPTION, $entries, true );

		return $entries[ $locale ];
	}

	public function urls( string $locale ): array {
		$entry = $this->entry( $locale );
		$rest  = add_query_arg(
			array(
				'locale' => $locale,
				'v'      => $entry['hash'],
			),
			rest_url( PanelDataController::ROUTE_BASE . '/panel-data' )
		);

		if ( '' === $entry['file'] ) {
			return array( $rest, $rest );
		}

		$uploads = wp_upload_dir();

		if ( ! $this->uploads_usable( $uploads ) ) {
			return array( $rest, $rest );
		}

		return array( set_url_scheme( (string) $uploads['baseurl'] ) . '/' . self::DIRECTORY . '/' . $entry['file'], $rest );
	}

	public function invalidate(): void {
		delete_option( self::OPTION );

		$directory = $this->directory();

		if ( '' === $directory ) {
			return;
		}

		$files = glob( $directory . 'panel-*.json' );

		foreach ( false === $files ? array() : $files as $file ) {
			wp_delete_file( $file );
		}
	}

	private function entries(): array {
		$stored = get_option( self::OPTION, array() );

		return is_array( $stored ) ? $stored : array();
	}

	private function is_well_formed( mixed $entry ): bool {
		if ( ! is_array( $entry ) || ! is_string( $entry['hash'] ?? null ) || ! is_string( $entry['file'] ?? null ) ) {
			return false;
		}

		$inline = $entry['inline'] ?? null;

		if ( ! is_array( $inline ) || ! is_string( $inline['open'] ?? null ) || ! is_string( $inline['loadError'] ?? null ) ) {
			return false;
		}

		return '' === $entry['file'] || 1 === preg_match( '/^panel-[A-Za-z0-9_\-]+-[0-9a-f]{12}\.json$/', $entry['file'] );
	}

	private function should_retry( string $locale, array $entry ): bool {
		if ( 1 !== preg_match( Sanitizer::LOCALE_PATTERN, $locale ) ) {
			return false;
		}

		return '' === ( $entry['file'] ?? '' ) && time() - (int) ( $entry['failed_at'] ?? 0 ) >= self::RETRY_AFTER;
	}

	private function build( string $locale, ?array $previous ): array {
		$payload = $this->panel_data->payload( $locale );
		$hash    = (string) $payload['hash'];
		$strings = (array) $payload['strings'];
		$entry   = array(
			'hash'      => $hash,
			'file'      => '',
			'inline'    => array(
				'open'      => (string) ( $strings['open'] ?? '' ),
				'loadError' => (string) ( $strings['loadError'] ?? '' ),
			),
			'failed_at' => 0,
		);

		if ( is_array( $previous ) && time() - (int) ( $previous['failed_at'] ?? 0 ) < self::RETRY_AFTER ) {
			$entry['failed_at'] = (int) $previous['failed_at'];

			return $entry;
		}

		if ( 1 !== preg_match( Sanitizer::LOCALE_PATTERN, $locale ) ) {
			return $entry;
		}

		$file = 'panel-' . $locale . '-' . $hash . '.json';

		if ( $this->write( $file, $this->panel_data->document( $payload ) ) ) {
			$entry['file'] = $file;
		} else {
			$entry['failed_at'] = time();
		}

		return $entry;
	}

	private function uploads_usable( array $uploads ): bool {
		return empty( $uploads['error'] ) && is_string( $uploads['basedir'] ?? null ) && is_string( $uploads['baseurl'] ?? null );
	}

	private function directory(): string {
		$uploads = wp_upload_dir();

		if ( ! $this->uploads_usable( $uploads ) ) {
			return '';
		}

		return trailingslashit( $uploads['basedir'] ) . self::DIRECTORY . '/';
	}

	private function write( string $file, string $contents ): bool {
		if ( ! function_exists( 'get_filesystem_method' ) || ! function_exists( 'WP_Filesystem' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}

		if ( 'direct' !== get_filesystem_method() ) {
			return false;
		}

		global $wp_filesystem;

		if ( ! WP_Filesystem() || ! $wp_filesystem instanceof WP_Filesystem_Base ) {
			return false;
		}

		$directory = $this->directory();

		if ( '' === $directory || ! wp_mkdir_p( $directory ) ) {
			return false;
		}

		if ( ! $wp_filesystem->exists( $directory . 'index.php' ) ) {
			$wp_filesystem->put_contents( $directory . 'index.php', "<?php\n" );
		}

		$temporary = $directory . $file . '.' . bin2hex( random_bytes( 4 ) ) . '.tmp';

		if ( ! $wp_filesystem->put_contents( $temporary, $contents ) ) {
			wp_delete_file( $temporary );

			return false;
		}

		if ( ! $wp_filesystem->move( $temporary, $directory . $file, true ) ) {
			wp_delete_file( $temporary );

			return false;
		}

		return true;
	}
}
