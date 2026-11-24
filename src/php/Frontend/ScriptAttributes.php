<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Frontend;

use Kotlinskidev\A11y\Settings\Repository;
use WP_HTML_Tag_Processor;

final class ScriptAttributes {

	public const OPT_OUT = array(
		'cloudflare'    => array( 'data-cfasync' => 'false' ),
		'wp-rocket'     => array( 'nowprocket' => true ),
		'litespeed'     => array(
			'data-no-optimize' => '1',
			'data-no-defer'    => '1',
			'data-no-minify'   => '1',
		),
		'jetpack-boost' => array( 'data-jetpack-boost' => 'ignore' ),
		'asset-cleanup' => array( 'data-wpacu-skip' => true ),
	);

	public const INLINE_IDS = array( 'kotlinskidev-a11y-bootstrap', 'kotlinskidev-a11y-loader-js-before' );

	public const SCRIPT_HANDLES = array(
		'kotlinskidev-a11y-loader',
		'kotlinskidev-a11y-kernel',
		'kotlinskidev-a11y-panel',
		'kotlinskidev-a11y-content',
		'kotlinskidev-a11y-color',
		'kotlinskidev-a11y-orientation',
	);

	private Repository $repository;

	public function __construct( ?Repository $repository = null ) {
		$this->repository = $repository ?? new Repository();
	}

	public static function supports_native_fetch_priority(): bool {
		$version = isset( $GLOBALS['wp_version'] ) && is_string( $GLOBALS['wp_version'] ) ? $GLOBALS['wp_version'] : '0';

		return version_compare( $version, '6.9', '>=' );
	}

	public function register(): void {
		add_filter( 'script_loader_tag', array( $this, 'filter_tag' ), 10, 2 );
		add_filter( 'wp_inline_script_attributes', array( $this, 'filter_inline' ) );
	}

	public function opt_out_attributes(): array {
		$attributes = array();

		foreach ( (array) ( $this->repository->get()['performance']['optOut'] ?? array() ) as $name ) {
			$attributes = array_merge( $attributes, self::OPT_OUT[ $name ] ?? array() );
		}

		return $attributes;
	}

	public function filter_inline( mixed $attributes ): mixed {
		if ( ! is_array( $attributes ) || ! in_array( $attributes['id'] ?? null, self::INLINE_IDS, true ) ) {
			return $attributes;
		}

		return array_merge( $attributes, $this->opt_out_attributes() );
	}

	public function filter_tag( mixed $tag, mixed $handle = '' ): mixed {
		if ( ! is_string( $tag ) || ! in_array( $handle, self::SCRIPT_HANDLES, true ) ) {
			return $tag;
		}

		$attributes = $this->opt_out_attributes();
		$priority   = (string) ( $this->repository->get()['performance']['fetchPriority'] ?? 'auto' );

		if ( ! self::supports_native_fetch_priority() && 'auto' !== $priority ) {
			$attributes['fetchpriority'] = $priority;
		}

		return array() === $attributes ? $tag : $this->apply( $tag, $attributes );
	}

	private function apply( string $tag, array $attributes ): string {
		$processor = new WP_HTML_Tag_Processor( $tag );

		while ( $processor->next_tag( array( 'tag_name' => 'script' ) ) ) {
			if ( null === $processor->get_attribute( 'src' ) ) {
				continue;
			}

			foreach ( $attributes as $name => $value ) {
				$processor->set_attribute( (string) $name, $value );
			}

			break;
		}

		return $processor->get_updated_html();
	}
}
