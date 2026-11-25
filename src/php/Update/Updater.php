<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Update;

use Closure;
use YahnisElsts\PluginUpdateChecker\v5\PucFactory;

final class Updater {

	public const DISABLE_CONSTANT   = 'KOTLINSKIDEV_A11Y_DISABLE_UPDATER';
	public const VERSION_PATTERN    = '/^\d+\.\d+\.\d+(-(beta|rc)\.\d+)?\z/';
	public const RELEASE_FILTER_ALL = 3;
	public const RELEASES_TRANSIENT = 'kotlinskidev_a11y_releases';

	private readonly Channel $channel;
	private readonly Closure $constants;

	public function __construct(
		private readonly string $plugin_file,
		private readonly string $factory = PucFactory::class,
		?Channel $channel = null,
		?Closure $constants = null
	) {
		$this->constants = $constants ?? static fn ( string $name ): mixed => defined( $name ) ? constant( $name ) : null;
		$this->channel   = $channel ?? new Channel( $this->constants );
	}

	public function enabled(): bool {
		if ( true === ( $this->constants )( self::DISABLE_CONSTANT ) ) {
			return false;
		}

		return (bool) apply_filters( 'kotlinskidev_a11y_enable_updater', true );
	}

	public function register(): ?object {
		if ( ! $this->enabled() || ! class_exists( $this->factory ) ) {
			return null;
		}

		$source  = $this->source();
		$checker = $this->factory::buildUpdateChecker( $source['repository'], $this->plugin_file, $source['slug'] );

		$checker->setBranch( $source['branch'] );
		$checker->getVcsApi()->enableReleaseAssets( $source['asset_pattern'] );

		if ( $this->channel->is_beta() ) {
			$checker->setReleaseVersionFilter( self::VERSION_PATTERN, self::RELEASE_FILTER_ALL, 20 );
		}

		$token = $this->token();

		if ( '' !== $token ) {
			$checker->setAuthentication( $token );
		}

		return $checker;
	}

	public function reset_state(): void {
		delete_site_option( 'external_updates-' . $this->source()['slug'] );
		delete_site_transient( 'update_plugins' );
		delete_site_transient( self::RELEASES_TRANSIENT );
	}

	public function source(): array {
		$defaults = array(
			'repository'    => 'https://github.com/Kotlinski95/kotlinskidev-accessibility-plugin/',
			'slug'          => 'kotlinskidev-accessibility',
			'asset_pattern' => '/kotlinskidev-accessibility\.zip/',
			'branch'        => 'main',
		);

		$filtered = apply_filters( 'kotlinskidev_a11y_update_source', $defaults );
		$filtered = is_array( $filtered ) ? $filtered : array();

		$source = array();

		foreach ( $defaults as $key => $default ) {
			$value          = $filtered[ $key ] ?? $default;
			$source[ $key ] = is_string( $value ) && '' !== $value ? $value : $default;
		}

		return $source;
	}

	public function token(): string {
		$token = apply_filters( 'kotlinskidev_a11y_update_token', '' );

		return is_string( $token ) ? $token : '';
	}

	public function github_repository(): ?string {
		$parts = wp_parse_url( $this->source()['repository'] );

		if ( ! is_array( $parts ) || 'https' !== ( $parts['scheme'] ?? '' ) || 'github.com' !== strtolower( (string) ( $parts['host'] ?? '' ) ) ) {
			return null;
		}

		$path = trim( (string) ( $parts['path'] ?? '' ), '/' );

		return 1 === preg_match( '#^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$#', $path ) ? $path : null;
	}
}
