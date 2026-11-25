<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Triggers;

final class ButtonShortcode {

	public const TAG = 'kotlinskidev_a11y_button';

	private Button $button;

	public function __construct( ?Button $button = null ) {
		$this->button = $button ?? new Button();
	}

	public function register(): void {
		add_shortcode( self::TAG, array( $this, 'render' ) );
	}

	public function render( mixed $atts = array() ): string {
		$attributes = shortcode_atts(
			array(
				'action'    => 'open',
				'label'     => '',
				'element'   => 'button',
				'class'     => '',
				'show_icon' => '',
			),
			is_array( $atts ) ? $atts : array(),
			self::TAG
		);

		return $this->button->render( $attributes );
	}
}
