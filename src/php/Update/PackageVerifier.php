<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Update;

use WP_Error;

final class PackageVerifier {

	public const MISMATCH_CODE   = 'kotlinskidev_a11y_checksum_mismatch';
	public const MISSING_CODE    = 'kotlinskidev_a11y_checksum_missing';
	public const UNVERIFIED_FLAG = 'kotlinskidev_a11y_unverified_package';

	public const CHECKSUM_REQUIRED_FROM = '1.0.0-beta.1';

	private static array $expected = array();

	public function __construct(
		private readonly Updater $updater,
		private readonly string $plugin_basename
	) {}

	public static function expect( string $package, string $sha256_url ): void {
		self::$expected[ $package ] = $sha256_url;
	}

	public static function forget(): void {
		self::$expected = array();
	}

	public function register(): void {
		add_filter( 'upgrader_pre_download', array( $this, 'verify' ), 10, 4 );
	}

	public function verify( mixed $reply, mixed $package, mixed $upgrader = null, mixed $hook_extra = array() ): mixed {
		if ( false !== $reply || ! is_string( $package ) || ! $this->updater->enabled() ) {
			return $reply;
		}

		$rollback = isset( self::$expected[ $package ] );
		$plugin   = is_array( $hook_extra ) ? ( $hook_extra['plugin'] ?? null ) : null;

		if ( ! $rollback && $plugin !== $this->plugin_basename ) {
			return $reply;
		}

		$required   = $rollback || $this->checksum_required( $package );
		$sha256_url = $rollback ? self::$expected[ $package ] : $package . '.sha256';

		$allowed = $rollback
			? self::same_https_host( $package, $sha256_url )
			: $this->trusted( $package ) && $this->trusted( $sha256_url );

		if ( ! $allowed ) {
			return $this->unverifiable( $reply, $package, $required, __( 'The release is not served from a trusted HTTPS location, so its SHA-256 checksum cannot be checked.', 'kotlinskidev-accessibility' ) );
		}

		$expected = $this->fetch_checksum( $sha256_url );

		if ( null === $expected ) {
			return $this->unverifiable( $reply, $package, $required, __( 'This release has no SHA-256 checksum file, so it cannot be installed safely.', 'kotlinskidev-accessibility' ) );
		}

		$file = download_url( $package );

		if ( $file instanceof WP_Error ) {
			return $file;
		}

		$actual = hash_file( 'sha256', $file );

		if ( false === $actual || ! hash_equals( $expected, $actual ) ) {
			wp_delete_file( $file );

			return new WP_Error( self::MISMATCH_CODE, __( 'The downloaded package does not match its SHA-256 checksum and was discarded.', 'kotlinskidev-accessibility' ) );
		}

		delete_site_option( self::UNVERIFIED_FLAG );

		return $file;
	}

	public static function same_https_host( string $first, string $second ): bool {
		$one = wp_parse_url( $first );
		$two = wp_parse_url( $second );

		if ( ! is_array( $one ) || ! is_array( $two ) ) {
			return false;
		}

		$host = strtolower( (string) ( $one['host'] ?? '' ) );

		return 'https' === ( $one['scheme'] ?? '' )
			&& 'https' === ( $two['scheme'] ?? '' )
			&& '' !== $host
			&& strtolower( (string) ( $two['host'] ?? '' ) ) === $host;
	}

	public function trusted( string $url ): bool {
		$repository = $this->updater->github_repository();

		if ( null === $repository ) {
			return false;
		}

		return str_starts_with( $url, 'https://github.com/' . $repository . '/releases/download/' );
	}

	public function fetch_checksum( string $url ): ?string {
		$response = wp_safe_remote_get(
			$url,
			array(
				'timeout'             => 10,
				'limit_response_size' => 1024,
			)
		);

		if ( $response instanceof WP_Error || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
			return null;
		}

		return self::parse_checksum( (string) wp_remote_retrieve_body( $response ) );
	}

	public static function parse_checksum( string $body ): ?string {
		return 1 === preg_match( '/^\s*([A-Fa-f0-9]{64})(\s|$)/', $body, $match ) ? strtolower( $match[1] ) : null;
	}

	private function unverifiable( mixed $reply, string $package, bool $required, string $message ): mixed {
		if ( $required ) {
			return new WP_Error( self::MISSING_CODE, $message );
		}

		update_site_option( self::UNVERIFIED_FLAG, $package );

		return $reply;
	}

	private function checksum_required( string $package ): bool {
		$version = $this->target_version( $package );

		return null === $version || version_compare( $version, self::CHECKSUM_REQUIRED_FROM, '>=' );
	}

	private function target_version( string $package ): ?string {
		$version = null;

		if ( $this->trusted( $package ) && 1 === preg_match( '#/releases/download/v?([^/]+)/#', $package, $match ) ) {
			$version = $match[1];
		} else {
			$transient = get_site_transient( 'update_plugins' );
			$entry     = is_object( $transient ) && is_array( $transient->response ?? null ) ? ( $transient->response[ $this->plugin_basename ] ?? null ) : null;
			$version   = is_object( $entry ) && is_string( $entry->new_version ?? null ) ? $entry->new_version : null;
		}

		return null !== $version && 1 === preg_match( Updater::VERSION_PATTERN, $version ) ? $version : null;
	}
}
