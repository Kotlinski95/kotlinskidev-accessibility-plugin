<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Settings;

use Kotlinskidev\A11y\Settings\Schema;
use Kotlinskidev\A11y\Tests\TestCase;

final class SchemaTest extends TestCase {

	public function test_every_definition_has_required_shape(): void {
		Schema::walk(
			function ( string $path, array $definition ): void {
				$this->assertArrayHasKey( 'type', $definition, $path );
				$this->assertArrayHasKey( 'default', $definition, $path );
				$this->assertArrayHasKey( 'sanitize', $definition, $path );
				if ( 'enum' === $definition['sanitize'] ) {
					$this->assertContains( $definition['default'], $definition['enum'], $path );
				}
			}
		);
	}

	public function test_all_spec_features_have_enabled_and_default(): void {
		$defaults = Schema::defaults();

		$this->assertCount( 26, Schema::feature_keys() );
		foreach ( Schema::feature_keys() as $key ) {
			$this->assertTrue( $defaults['features'][ $key ]['enabled'], $key );
			$this->assertFalse( $defaults['features'][ $key ]['default'], $key );
		}
	}

	public function test_profiles_default_enabled_with_valid_presets(): void {
		$defaults = Schema::defaults();

		$this->assertSame(
			array( 'visionImpaired', 'seizureSafe', 'adhdFriendly', 'blindness', 'epilepsySafe' ),
			array_keys( $defaults['profiles'] )
		);
		foreach ( $defaults['profiles'] as $profile ) {
			$this->assertTrue( $profile['enabled'] );
			$this->assertNotEmpty( $profile['features'] );
			$this->assertSame( array(), array_diff( $profile['features'], Schema::feature_keys() ) );
		}
	}

	public function test_widget_defaults(): void {
		$widget = Schema::defaults()['widget'];

		foreach ( array( 'desktop', 'tablet', 'mobile' ) as $device ) {
			$this->assertSame( 'bottom-right', $widget['position'][ $device ] );
			$this->assertSame( 20, $widget['offsetX'][ $device ] );
			$this->assertSame( 20, $widget['offsetY'][ $device ] );
		}
		$this->assertSame( 'md', $widget['size'] );
		$this->assertSame( 'universal', $widget['icon'] );
		$this->assertFalse( $widget['iconBorder'] );
	}

	public function test_visibility_theme_storage_and_misc_defaults(): void {
		$defaults = Schema::defaults();

		$this->assertSame( array( 'desktop' => true, 'tablet' => true, 'mobile' => true ), $defaults['visibility']['devices'] );
		$this->assertSame( array( 'tablet' => 1024, 'mobile' => 768 ), $defaults['visibility']['breakpoints'] );
		foreach ( array( 'excludePostIds', 'excludePostTypes', 'excludeRoles', 'excludeUrlPatterns' ) as $key ) {
			$this->assertSame( array(), $defaults['visibility'][ $key ] );
		}
		$this->assertSame( 'auto', $defaults['theme']['mode'] );
		$this->assertSame( 'html.dark-mode, body.dark-mode', $defaults['theme']['darkSelector'] );
		$this->assertSame( 'html.light-mode, body.light-mode', $defaults['theme']['lightSelector'] );
		$this->assertTrue( $defaults['theme']['followPrefersColorScheme'] );
		$this->assertSame( 2147483000, $defaults['tokens']['zIndex'] );
		$this->assertSame( '', $defaults['customCss'] );
		$this->assertSame( array( 'mode' => 'local', 'ttlDays' => 365, 'key' => 'ka11y' ), $defaults['storage'] );
		$this->assertSame( array( 'pageId' => 0, 'url' => '', 'content' => array() ), $defaults['statement'] );
		$this->assertSame( array( 'enabled' => true, 'combo' => 'Alt+Shift+A' ), $defaults['shortcut'] );
		$this->assertSame( array( 'allow' => true, 'days' => array( 1, 7, 30 ) ), $defaults['hideToolbar'] );
		$this->assertSame( array(), $defaults['labels'] );
		$this->assertSame( array( 'excludeSelectors' => '#wpadminbar', 'loadStrategy' => 'defer' ), $defaults['advanced'] );
		$this->assertSame( Schema::VERSION, $defaults['schemaVersion'] );
	}

	public function test_definition_lookup_and_assign_read(): void {
		$this->assertSame( 'enum', Schema::definition( 'storage.mode' )['sanitize'] );
		$this->assertNull( Schema::definition( 'nope.key' ) );

		$tree = array();
		Schema::assign( $tree, 'a.b.c', 1 );
		$this->assertSame( array( 'a' => array( 'b' => array( 'c' => 1 ) ) ), $tree );
		$this->assertSame( 1, Schema::read( $tree, 'a.b.c', $found ) );
		$this->assertTrue( $found );
		$this->assertNull( Schema::read( $tree, 'a.x', $found ) );
		$this->assertFalse( $found );
	}
}
