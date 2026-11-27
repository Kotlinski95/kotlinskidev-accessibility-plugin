<?php
/**
 * Plugin Name:       Kotlinskidev Accessibility
 * Description:       Accessibility widget with content, color and orientation adjustments.
 * Version:           1.0.3
 * Requires at least: 6.4
 * Requires PHP:      8.1
 * Author:            Adrian Kotlinski
 * Author URI:        https://kotlinskidev.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       kotlinskidev-accessibility
 * Domain Path:       /languages
 */

declare(strict_types=1);

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'KOTLINSKIDEV_A11Y_VERSION', '1.0.3' );
define( 'KOTLINSKIDEV_A11Y_API', 1 );
define( 'KOTLINSKIDEV_A11Y_FILE', __FILE__ );
define( 'KOTLINSKIDEV_A11Y_DIR', plugin_dir_path( __FILE__ ) );
define( 'KOTLINSKIDEV_A11Y_URL', plugin_dir_url( __FILE__ ) );

require_once KOTLINSKIDEV_A11Y_DIR . 'src/php/requirements.php';

if ( ! kotlinskidev_a11y_requirements_met( KOTLINSKIDEV_A11Y_DIR ) ) {
	return;
}

require_once KOTLINSKIDEV_A11Y_DIR . 'vendor/autoload.php';
require_once KOTLINSKIDEV_A11Y_DIR . 'src/php/functions.php';

\Kotlinskidev\A11y\Plugin::boot();
