<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Update;

use Closure;
use Kotlinskidev\A11y\Settings\Repository;
use WP_Error;

final class Rollback {

	public const FLOOR            = '0.4.0';
	public const LIMIT            = 3;
	public const CACHE_TTL        = 43200;
	public const BACKUP_OPTION    = 'kotlinskidev_a11y_settings_backup';
	public const ASSET            = 'kotlinskidev-accessibility.zip';
	public const NOT_FOUND_CODE   = 'kotlinskidev_a11y_rollback_unavailable';
	public const FETCH_ERROR_CODE = 'kotlinskidev_a11y_releases_unavailable';

	private readonly Closure $upgrade;

	public function __construct(
		private readonly Updater $updater,
		private readonly Channel $channel,
		private readonly string $installed,
		?Closure $upgrade = null
	) {
		$this->upgrade = $upgrade ?? static function ( string $package ): mixed {
			require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';

			$upgrader = new \Plugin_Upgrader( new \Plugin_Upgrader_Skin() );

			return $upgrader->install( $package, array( 'overwrite_package' => true ) );
		};
	}

	public static function valid_version( mixed $version ): bool {
		return is_string( $version ) && 1 === preg_match( Updater::VERSION_PATTERN, $version );
	}

	public function candidates( bool $refresh = false ): array|WP_Error {
		$all = $this->all_releases( $refresh );

		if ( $all instanceof WP_Error ) {
			return $all;
		}

		$beta     = $this->channel->is_beta();
		$eligible = array_values(
			array_filter(
				$all,
				fn ( array $release ): bool => version_compare( $release['version'], $this->installed, '<' )
					&& version_compare( $release['version'], self::FLOOR, '>=' )
					&& ( $beta || ! $release['prerelease'] )
			)
		);

		usort( $eligible, static fn ( array $a, array $b ): int => version_compare( $b['version'], $a['version'] ) );

		return array_slice( $eligible, 0, self::LIMIT );
	}

	public function candidate( string $version ): ?array {
		if ( ! self::valid_version( $version ) ) {
			return null;
		}

		$candidates = $this->candidates();

		if ( $candidates instanceof WP_Error ) {
			return null;
		}

		foreach ( $candidates as $candidate ) {
			if ( $candidate['version'] === $version ) {
				return $candidate;
			}
		}

		return null;
	}

	public function run( string $version ): bool|WP_Error {
		$candidate = $this->candidate( $version );

		if ( null === $candidate ) {
			return new WP_Error( self::NOT_FOUND_CODE, __( 'That version is not available for rollback.', 'kotlinskidev-accessibility' ) );
		}

		$this->backup_settings();
		PackageVerifier::expect( $candidate['package'], $candidate['sha256_url'] );

		try {
			$result = ( $this->upgrade )( $candidate['package'] );
		} finally {
			PackageVerifier::forget();
		}

		if ( $result instanceof WP_Error ) {
			return $result;
		}

		return true === $result ? true : new WP_Error( self::NOT_FOUND_CODE, __( 'The rollback did not complete.', 'kotlinskidev-accessibility' ) );
	}

	public function backup_settings(): void {
		update_option( self::BACKUP_OPTION, get_option( Repository::OPTION, array() ), false );
	}

	private function all_releases( bool $refresh ): array|WP_Error {
		if ( ! $refresh ) {
			$cached = get_site_transient( Updater::RELEASES_TRANSIENT );

			if ( is_array( $cached ) ) {
				return $cached;
			}
		}

		$releases = $this->updater->github_repository() === null ? $this->filtered_releases() : $this->github_releases();

		if ( $releases instanceof WP_Error ) {
			return $releases;
		}

		set_site_transient( Updater::RELEASES_TRANSIENT, $releases, self::CACHE_TTL );

		return $releases;
	}

	private function filtered_releases(): array {
		$supplied = apply_filters( 'kotlinskidev_a11y_rollback_releases', array() );
		$releases = array();

		foreach ( is_array( $supplied ) ? $supplied : array() as $item ) {
			$release = $this->normalise( $item );

			if ( null !== $release ) {
				$releases[] = $release;
			}
		}

		return $releases;
	}

	private function normalise( mixed $item ): ?array {
		if ( ! is_array( $item ) ) {
			return null;
		}

		$version = $item['version'] ?? null;
		$package = $item['package'] ?? null;
		$sha_url = $item['sha256_url'] ?? null;

		if ( ! self::valid_version( $version ) || ! is_string( $package ) || ! is_string( $sha_url ) ) {
			return null;
		}

		if ( ! PackageVerifier::same_https_host( $package, $sha_url ) ) {
			return null;
		}

		return array(
			'version'    => $version,
			'prerelease' => str_contains( $version, '-' ),
			'package'    => $package,
			'sha256_url' => $sha_url,
		);
	}

	private function github_releases(): array|WP_Error {
		$repository = (string) $this->updater->github_repository();
		$headers    = array(
			'Accept'     => 'application/vnd.github+json',
			'User-Agent' => 'kotlinskidev-accessibility',
		);
		$token      = $this->updater->token();

		if ( '' !== $token ) {
			$headers['Authorization'] = 'Bearer ' . $token;
		}

		$response = wp_remote_get(
			'https://api.github.com/repos/' . $repository . '/releases?per_page=30',
			array(
				'timeout'     => 10,
				'redirection' => 0,
				'headers'     => $headers,
			)
		);

		if ( $response instanceof WP_Error ) {
			return new WP_Error( self::FETCH_ERROR_CODE, __( 'Could not reach GitHub to list releases.', 'kotlinskidev-accessibility' ) );
		}

		$data = json_decode( (string) wp_remote_retrieve_body( $response ), true );

		if ( 200 !== (int) wp_remote_retrieve_response_code( $response ) || ! is_array( $data ) ) {
			return new WP_Error( self::FETCH_ERROR_CODE, __( 'GitHub returned no release list.', 'kotlinskidev-accessibility' ) );
		}

		$releases = array();

		foreach ( $data as $item ) {
			$release = $this->from_github( $item, $repository );

			if ( null !== $release ) {
				$releases[] = $release;
			}
		}

		return $releases;
	}

	private function from_github( mixed $item, string $repository ): ?array {
		if ( ! is_array( $item ) || ! empty( $item['draft'] ) || ! is_string( $item['tag_name'] ?? null ) ) {
			return null;
		}

		$version = ltrim( $item['tag_name'], 'v' );

		if ( ! self::valid_version( $version ) || ! is_array( $item['assets'] ?? null ) ) {
			return null;
		}

		$prefix = 'https://github.com/' . $repository . '/releases/download/';
		$urls   = array();

		foreach ( $item['assets'] as $asset ) {
			$name = is_array( $asset ) ? ( $asset['name'] ?? null ) : null;
			$url  = is_array( $asset ) ? ( $asset['browser_download_url'] ?? null ) : null;

			if ( is_string( $name ) && is_string( $url ) && str_starts_with( $url, $prefix ) ) {
				$urls[ $name ] = $url;
			}
		}

		if ( ! isset( $urls[ self::ASSET ], $urls[ self::ASSET . '.sha256' ] ) ) {
			return null;
		}

		return array(
			'version'    => $version,
			'prerelease' => ! empty( $item['prerelease'] ) || str_contains( $version, '-' ),
			'package'    => $urls[ self::ASSET ],
			'sha256_url' => $urls[ self::ASSET . '.sha256' ],
		);
	}
}
