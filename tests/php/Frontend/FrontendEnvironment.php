<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Frontend;

use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Frontend\PanelDataStore;
use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Settings\Schema;

trait FrontendEnvironment {

	private array $stored_settings = array();
	private array $panel_entries   = array();

	private function frontend_environment( string $locale = 'en_US', string $uploads_url = 'https://example.test/wp-content/uploads' ): void {
		$this->stored_settings = array( 'schemaVersion' => Schema::VERSION );
		$this->panel_entries   = array(
			$locale => array(
				'hash'      => '0123456789ab',
				'file'      => 'panel-' . $locale . '-0123456789ab.json',
				'inline'    => array(
					'open'      => 'Open accessibility settings',
					'loadError' => 'Accessibility tools could not load. Select the button to try again.',
				),
				'failed_at' => 0,
			),
		);

		Functions\stubs(
			array(
				'is_feed'               => false,
				'is_customize_preview'  => false,
				'get_queried_object_id' => 0,
				'get_post_type'         => false,
				'home_url'              => 'https://example.test',
				'wp_unslash'            => static fn ( $value ) => $value,
				'wp_parse_url'          => static fn ( $url, $component = -1 ) => parse_url( (string) $url, $component ),
				'wp_get_current_user'   => (object) array( 'roles' => array() ),
				'wp_json_encode'        => static fn ( $value, $flags = 0 ) => json_encode( $value, $flags ),
				'__'                    => static fn ( $text ) => $text,
				'get_permalink'         => false,
				'set_url_scheme'        => static fn ( $url ) => $url,
				'switch_to_locale'      => false,
				'rest_url'              => static fn ( $path ) => 'https://example.test/wp-json/' . $path,
				'add_query_arg'         => static fn ( $args, $url ) => $url . '?' . http_build_query( $args ),
			)
		);
		Functions\when( 'wp_upload_dir' )->justReturn(
			array(
				'basedir' => sys_get_temp_dir(),
				'baseurl' => $uploads_url,
			)
		);
		Functions\when( 'determine_locale' )->justReturn( $locale );
		Functions\when( 'get_locale' )->justReturn( $locale );
		Functions\when( 'get_option' )->alias(
			fn ( string $name, mixed $fallback = false ): mixed => match ( $name ) {
				Repository::OPTION     => $this->stored_settings,
				PanelDataStore::OPTION => $this->panel_entries,
				default                => $fallback,
			}
		);
		$_SERVER['REQUEST_URI'] = '/';
		Repository::flush();
	}

	private function store_settings( array $settings ): void {
		$this->stored_settings = array_replace_recursive( array( 'schemaVersion' => Schema::VERSION ), $settings );
		Repository::flush();
	}
}
