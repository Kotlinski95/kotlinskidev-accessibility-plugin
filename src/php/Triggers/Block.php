<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Triggers;

final class Block {

	public const NAME = 'kotlinskidev-a11y/trigger';

	private Button $button;

	public function __construct( ?Button $button = null ) {
		$this->button = $button ?? new Button();
	}

	public function register(): void {
		add_action( 'init', array( $this, 'register_block' ) );
	}

	public function register_block(): void {
		register_block_type_from_metadata(
			KOTLINSKIDEV_A11Y_DIR . 'build/blocks/trigger',
			array( 'render_callback' => array( $this, 'render' ) )
		);
	}

	public function render( mixed $attributes = array(), string $content = '', mixed $block = null ): string {
		$attributes = is_array( $attributes ) ? $attributes : array();
		$wrapper    = $this->wrapper( get_block_wrapper_attributes() );

		$html = $this->button->render(
			array(
				'action'    => $attributes['action'] ?? 'open',
				'label'     => $attributes['label'] ?? '',
				'element'   => $attributes['element'] ?? 'button',
				'show_icon' => $attributes['showIcon'] ?? false,
				'class'     => $wrapper['class'],
				'style'     => $wrapper['style'],
			)
		);

		return '' !== $html && $this->in_navigation( $block ) ? '<li class="wp-block-navigation-item">' . $html . '</li>' : $html;
	}

	private function in_navigation( mixed $block ): bool {
		$context = is_object( $block ) && isset( $block->context ) && is_array( $block->context ) ? $block->context : array();

		return array_key_exists( 'showSubmenuIcon', $context );
	}

	private function wrapper( string $attributes ): array {
		$found = array(
			'class' => '',
			'style' => '',
		);

		foreach ( array_keys( $found ) as $name ) {
			if ( 1 === preg_match( '/(?:^|\s)' . $name . '="([^"]*)"/', $attributes, $match ) ) {
				$found[ $name ] = html_entity_decode( $match[1], ENT_QUOTES );
			}
		}

		return $found;
	}
}
