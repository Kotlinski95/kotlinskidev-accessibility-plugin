<?php
/**
 * Plugin Name:       Kotlinskidev Accessibility
 * Description:       Accessibility widget with content, color and orientation adjustments.
 * Version:           0.1.1
 * Requires at least: 6.4
 * Requires PHP:      8.1
 * Author:            Adrian Kotlinski
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       kotlinskidev-accessibility
 * Domain Path:       /languages
 */

declare(strict_types=1);

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'KOTLINSKIDEV_A11Y_VERSION', '0.1.1' );
define( 'KOTLINSKIDEV_A11Y_FILE', __FILE__ );
define( 'KOTLINSKIDEV_A11Y_DIR', plugin_dir_path( __FILE__ ) );
define( 'KOTLINSKIDEV_A11Y_URL', plugin_dir_url( __FILE__ ) );

$kotlinskidev_a11y_autoload = KOTLINSKIDEV_A11Y_DIR . 'vendor/autoload.php';

if ( ! is_readable( $kotlinskidev_a11y_autoload ) ) {
	return;
}

require_once $kotlinskidev_a11y_autoload;

\Kotlinskidev\A11y\Plugin::boot();
