<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Update;

use YahnisElsts\PluginUpdateChecker\v5\PucFactory;

final class Updater {

	public function __construct(
		private readonly string $plugin_file,
		private readonly string $factory = PucFactory::class
	) {}

	public function register(): ?object {
		if ( ! class_exists( $this->factory ) ) {
			return null;
		}

		$source  = $this->source();
		$checker = $this->factory::buildUpdateChecker( $source['repository'], $this->plugin_file, $source['slug'] );

		$checker->setBranch( $source['branch'] );
		$checker->getVcsApi()->enableReleaseAssets( $source['asset_pattern'] );

		$token = $this->token();

		if ( '' !== $token ) {
			$checker->setAuthentication( $token );
		}

		return $checker;
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

	private function token(): string {
		$token = apply_filters( 'kotlinskidev_a11y_update_token', '' );

		return is_string( $token ) ? $token : '';
	}
}
