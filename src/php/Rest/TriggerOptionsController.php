<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Rest;

use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Settings\Schema;
use WP_REST_Response;

final class TriggerOptionsController {

	public const REST_NAMESPACE = 'kotlinskidev-a11y/v1';

	private Repository $repository;

	public function __construct( ?Repository $repository = null ) {
		$this->repository = $repository ?? new Repository();
	}

	public function register_routes(): void {
		register_rest_route(
			self::REST_NAMESPACE,
			'/trigger-options',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_options' ),
				'permission_callback' => array( $this, 'check_permission' ),
			)
		);
	}

	public function check_permission(): bool {
		return current_user_can( 'edit_posts' );
	}

	public function get_options(): WP_REST_Response {
		$settings = $this->repository->get();

		return new WP_REST_Response(
			array(
				'features' => $this->enabled( Schema::feature_keys(), $settings['features'] ?? array() ),
				'profiles' => $this->enabled( Schema::profile_keys(), $settings['profiles'] ?? array() ),
			)
		);
	}

	private function enabled( array $keys, mixed $group ): array {
		$group = is_array( $group ) ? $group : array();

		return array_values(
			array_filter(
				$keys,
				static fn ( string $key ): bool => false !== ( $group[ $key ]['enabled'] ?? true )
			)
		);
	}
}
