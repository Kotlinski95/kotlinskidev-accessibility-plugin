<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Settings;

use Brain\Monkey\Filters;
use Kotlinskidev\A11y\Frontend\Actions;
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

	public function test_default_selectors_are_a_superset_of_the_legacy_ones(): void {
		$defaults = Schema::defaults();

		foreach ( array( Schema::LEGACY_DARK_SELECTOR => 'darkSelector', Schema::LEGACY_LIGHT_SELECTOR => 'lightSelector' ) as $legacy => $key ) {
			foreach ( array_map( 'trim', explode( ',', $legacy ) ) as $part ) {
				$this->assertContains( $part, array_map( 'trim', explode( ',', $defaults['theme'][ $key ] ) ) );
			}
		}
	}

	public function test_default_selectors_filter_overrides_schema_defaults(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_default_selectors' )->andReturn(
			array(
				'darkSelector'  => 'html.theme-night',
				'lightSelector' => '',
			)
		);

		$defaults = Schema::defaults();

		$this->assertSame( 'html.theme-night', $defaults['theme']['darkSelector'] );
		$this->assertSame( Schema::DEFAULT_LIGHT_SELECTOR, $defaults['theme']['lightSelector'] );
	}

	public function test_visibility_theme_storage_and_misc_defaults(): void {
		$defaults = Schema::defaults();

		$this->assertSame(
			array(
				'desktop' => true,
				'tablet'  => true,
				'mobile'  => true,
			),
			$defaults['visibility']['devices']
		);
		$this->assertSame(
			array(
				'tablet' => 1024,
				'mobile' => 768,
			),
			$defaults['visibility']['breakpoints']
		);
		foreach ( array( 'excludePostIds', 'excludePostTypes', 'excludeRoles', 'excludeUrlPatterns' ) as $key ) {
			$this->assertSame( array(), $defaults['visibility'][ $key ] );
		}
		$this->assertSame( 'auto', $defaults['theme']['mode'] );
		$this->assertSame( 'html.dark, html.dark-mode, html[data-theme="dark"], body.dark, body.dark-mode', $defaults['theme']['darkSelector'] );
		$this->assertSame( 'html.light, html.light-mode, html[data-theme="light"], body.light, body.light-mode', $defaults['theme']['lightSelector'] );
		$this->assertTrue( $defaults['theme']['followPrefersColorScheme'] );
		$this->assertSame( 2147483000, $defaults['tokens']['zIndex'] );
		$this->assertSame( '', $defaults['customCss'] );
		$this->assertSame(
			array(
				'mode'    => 'local',
				'ttlDays' => 365,
				'key'     => 'ka11y',
			),
			$defaults['storage']
		);
		$this->assertSame(
			array(
				'pageId'  => 0,
				'url'     => '',
				'content' => array(),
			),
			$defaults['statement']
		);
		$this->assertSame(
			array(
				'enabled' => true,
				'combo'   => 'Alt+Shift+A',
			),
			$defaults['shortcut']
		);
		$this->assertSame(
			array(
				'allow' => true,
				'days'  => array( 1, 7, 30 ),
			),
			$defaults['hideToolbar']
		);
		$this->assertSame( array(), $defaults['labels'] );
		$this->assertSame( array( 'excludeSelectors' => '#wpadminbar' ), $defaults['advanced'] );
		$this->assertSame( Schema::VERSION, $defaults['schemaVersion'] );
	}

	public function test_definition_lookup_and_assign_read(): void {
		$this->assertSame( 'enum', Schema::definition( 'storage.mode' )['sanitize'] );
		$this->assertNull( Schema::definition( 'nope.key' ) );

		$tree = array();
		Schema::assign( $tree, 'a.b.c', 1 );
		$this->assertSame( array( 'a' => array( 'b' => array( 'c' => 1 ) ) ), $tree );
		$found = false;
		$this->assertSame( 1, Schema::read( $tree, 'a.b.c', $found ) );
		$this->assertTrue( $found );
		$this->assertNull( Schema::read( $tree, 'a.x', $found ) );
		$this->assertFalse( $found );
	}

	public function test_version_is_two_and_load_strategy_is_gone(): void {
		$this->assertSame( 5, Schema::VERSION );
		$this->assertNull( Schema::definition( 'advanced.loadStrategy' ) );
		$this->assertArrayNotHasKey( 'loadStrategy', Schema::defaults()['advanced'] );
	}

	public function test_v4_panel_and_token_definitions(): void {
		$defaults = Schema::defaults();

		$this->assertSame( array( 'primaryDark', 'onPrimaryDark', 'headerBg', 'onHeader', 'canvasLight', 'canvasDark' ), Schema::PANEL_TOKENS );

		foreach ( Schema::PANEL_TOKENS as $token ) {
			$this->assertSame( 'color', Schema::definition( 'tokens.' . $token )['sanitize'] );
		}

		$this->assertSame( '#7aa7ff', $defaults['tokens']['primaryDark'] );
		$this->assertSame( '#16181d', $defaults['tokens']['headerBg'] );
		$this->assertSame( '#101114', $defaults['tokens']['canvasDark'] );
		$this->assertSame( 3, $defaults['panel']['columns'] );
		$this->assertSame(
			array(
				'profiles'    => true,
				'content'     => true,
				'color'       => true,
				'orientation' => true,
				'skip'        => true,
			),
			$defaults['panel']['sections']
		);
		$this->assertTrue( $defaults['panel']['languageSwitcher'] );
		$this->assertTrue( $defaults['panel']['credit'] );
		$this->assertSame( 'classic', $defaults['panel']['preset'] );
		$this->assertSame( array( 'classic', 'brand', 'soft', 'contrast', 'custom' ), Schema::definition( 'panel.preset' )['enum'] );
	}

	public function test_panel_and_launcher_appearance_defaults_keep_current_behaviour(): void {
		$defaults = Schema::defaults();

		$this->assertSame( 'choose', $defaults['panel']['languageMode'] );
		$this->assertFalse( $defaults['panel']['backdrop'] );
		$this->assertTrue( $defaults['panel']['closeOnBackdrop'] );
		$this->assertSame( 'slide', $defaults['panel']['animation'] );
		$this->assertSame( 220, $defaults['panel']['animationMs'] );
		$this->assertSame( 448, $defaults['panel']['width'] );
		$this->assertSame( 'auto', $defaults['panel']['side'] );
		$this->assertSame( 0, $defaults['panel']['offset'] );
		$this->assertSame( 'circle', $defaults['widget']['shape'] );
		$this->assertSame( '', $defaults['widget']['bg'] );
		$this->assertSame( '', $defaults['widget']['fg'] );
		$this->assertSame( '', $defaults['widget']['bgDark'] );
		$this->assertSame( '', $defaults['widget']['fgDark'] );
		$this->assertSame( 'inherit', $defaults['widget']['sizes']['mobile'] );
		$this->assertSame( array( 280, 640 ), array( Schema::definition( 'panel.width' )['min'], Schema::definition( 'panel.width' )['max'] ) );
		$this->assertSame( 20, Schema::definition( 'panel.backdropBlur' )['max'] );
		$this->assertSame( 1000, Schema::definition( 'panel.animationMs' )['max'] );
		$this->assertSame( 200, Schema::definition( 'panel.offset' )['max'] );
	}

	public function test_performance_and_visibility_additions_have_defaults_and_enums(): void {
		$defaults = Schema::defaults();

		$this->assertSame(
			array(
				'preset'        => 'recommended',
				'strategy'      => 'interaction',
				'position'      => 'footer',
				'fetchPriority' => 'low',
				'prefetch'      => 'hover',
				'pageCss'       => 'lazy',
				'deviceSkip'    => true,
				'optOut'        => array(),
			),
			$defaults['performance']
		);
		$this->assertSame( array( 'recommended', 'compatibility', 'custom' ), Schema::definition( 'performance.preset' )['enum'] );
		$this->assertSame( array( 'interaction', 'idle', 'defer', 'async', 'eager' ), Schema::definition( 'performance.strategy' )['enum'] );
		$this->assertSame( array( 'head', 'footer' ), Schema::definition( 'performance.position' )['enum'] );
		$this->assertSame( array( 'low', 'auto', 'high' ), Schema::definition( 'performance.fetchPriority' )['enum'] );
		$this->assertSame( array( 'none', 'hover', 'idle' ), Schema::definition( 'performance.prefetch' )['enum'] );
		$this->assertSame( array( 'lazy', 'linked', 'inline' ), Schema::definition( 'performance.pageCss' )['enum'] );
		$this->assertSame( array( 'cloudflare', 'wp-rocket', 'litespeed', 'jetpack-boost', 'asset-cleanup' ), Schema::definition( 'performance.optOut' )['enum'] );
		$this->assertSame( 'everywhere', $defaults['visibility']['mode'] );
		$this->assertSame( array( 'everywhere', 'only_on', 'except_on' ), Schema::definition( 'visibility.mode' )['enum'] );
		foreach ( array( 'includePostIds', 'includePostTypes', 'includeTemplates', 'includeRoles', 'includeUrlPatterns', 'excludeTemplates' ) as $key ) {
			$this->assertSame( array(), $defaults['visibility'][ $key ], $key );
		}
		$this->assertSame( 'int_list', Schema::definition( 'visibility.includePostIds' )['sanitize'] );
		$this->assertSame( 1, Schema::definition( 'visibility.includePostIds' )['min'] );
	}

	public function test_performance_presets_match_spec_rows(): void {
		$presets = Schema::performance_presets();

		$this->assertSame( array( 'recommended', 'compatibility' ), array_keys( $presets ) );
		$this->assertSame(
			array(
				'strategy'      => 'interaction',
				'position'      => 'footer',
				'fetchPriority' => 'low',
				'prefetch'      => 'hover',
				'pageCss'       => 'lazy',
				'deviceSkip'    => true,
				'optOut'        => array(),
			),
			$presets['recommended']
		);
		$this->assertSame(
			array(
				'strategy'      => 'eager',
				'position'      => 'footer',
				'fetchPriority' => 'auto',
				'prefetch'      => 'none',
				'pageCss'       => 'linked',
				'deviceSkip'    => false,
				'optOut'        => array( 'cloudflare', 'wp-rocket', 'litespeed', 'jetpack-boost', 'asset-cleanup' ),
			),
			$presets['compatibility']
		);
	}

	public function test_apply_performance_preset_overwrites_for_named_presets_and_keeps_custom(): void {
		$tree = array(
			'performance' => array(
				'preset'        => 'compatibility',
				'strategy'      => 'idle',
				'position'      => 'head',
				'fetchPriority' => 'high',
				'prefetch'      => 'idle',
				'pageCss'       => 'inline',
				'deviceSkip'    => true,
				'optOut'        => array(),
			),
		);

		$compat = Schema::apply_performance_preset( $tree );
		$this->assertSame( 'compatibility', $compat['performance']['preset'] );
		foreach ( Schema::performance_presets()['compatibility'] as $key => $value ) {
			$this->assertSame( $value, $compat['performance'][ $key ], $key );
		}

		$tree['performance']['preset'] = 'recommended';
		$recommended                   = Schema::apply_performance_preset( $tree );
		foreach ( Schema::performance_presets()['recommended'] as $key => $value ) {
			$this->assertSame( $value, $recommended['performance'][ $key ], $key );
		}

		$tree['performance']['preset'] = 'custom';
		$this->assertSame( $tree, Schema::apply_performance_preset( $tree ) );
	}

	public function test_trigger_and_launcher_definitions(): void {
		$defaults = Schema::defaults();

		$this->assertSame( 'floating', $defaults['widget']['launcher'] );
		$this->assertSame( '', $defaults['widget']['mount'] );
		$this->assertSame( array(), $defaults['triggers']['selectors'] );
		$this->assertSame( array( 'open', 'feature', 'profile' ), $defaults['triggers']['urlActions'] );
		$this->assertSame( array( 'floating', 'inline', 'hidden' ), Schema::definition( 'widget.launcher' )['enum'] );
		$this->assertSame( 'selector', Schema::definition( 'widget.mount' )['sanitize'] );
		$this->assertSame( 10, Schema::definition( 'triggers.selectors' )['max'] );
		$this->assertSame( 'selector_list', Schema::definition( 'triggers.selectors' )['sanitize'] );
		$this->assertSame( Actions::URL, Schema::definition( 'triggers.urlActions' )['enum'] );
	}
}
