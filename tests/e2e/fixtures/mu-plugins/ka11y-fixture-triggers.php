<?php
if ( ! defined( 'ABSPATH' ) || ! defined( 'WP_ENVIRONMENT_TYPE' ) || 'local' !== WP_ENVIRONMENT_TYPE ) {
	return;
}

if ( ! defined( 'KOTLINSKIDEV_A11Y_E2E' ) || ! KOTLINSKIDEV_A11Y_E2E ) {
	return;
}

if ( ! isset( $_COOKIE['ka11y_fixture_triggers'] ) || '1' !== $_COOKIE['ka11y_fixture_triggers'] ) {
	return;
}

add_action(
	'wp_footer',
	static function (): void {
		$block = do_blocks( '<!-- wp:kotlinskidev-a11y/trigger {"action":"feature:biggerText:2","label":"Block bigger text"} /-->' );

		echo '<div id="ka11y-fixture-triggers">';
		echo '<button type="button" id="t-before">Before</button>';
		echo '<a id="t-hash" href="#kotlinskidev-a11y">Hash open</a>';
		echo '<a id="t-profile" href="#ka11y/profile:adhdFriendly">Hash profile</a>';
		echo '<button type="button" id="t-class" class="ka11y-open">Class open</button>';
		echo '<button type="button" id="t-data" data-ka11y="feature:darkContrast">Data dark contrast</button>';
		echo '<a id="t-link" href="/statement" data-ka11y="toggle">Data toggle link</a>';
		echo '<nav class="fixture-a11y-menu"><a id="t-custom" href="#fixture-menu">Custom selector</a></nav>';
		echo '<span id="t-shortcode">' . do_shortcode( '[kotlinskidev_a11y_button action="open" label="Shortcode open"]' ) . '</span>';
		echo '<span id="t-block">' . $block . '</span>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo '<span id="t-php">';
		if ( function_exists( 'kotlinskidev_a11y_button' ) ) {
			kotlinskidev_a11y_button(
				array(
					'action' => 'toggle',
					'label'  => 'PHP toggle',
				)
			);
		}
		echo '</span>';
		echo '<button type="button" id="api-open">API open</button>';
		echo '<button type="button" id="t-unknown" data-ka11y="explode">Unknown action</button>';
		echo '<button type="button" id="t-disabled" data-ka11y="feature:highContrast">Disabled feature</button>';
		echo '<button type="button" id="t-reset" data-ka11y="reset">Reset</button>';
		echo '</div>';
		echo '<script>document.getElementById("api-open").addEventListener("click",function(){window.kotlinskidevA11y.open(this);});</script>';
	},
	5
);
