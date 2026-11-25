<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Update;

use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Tests\TestCase;
use Kotlinskidev\A11y\Update\Channel;
use Kotlinskidev\A11y\Update\Updater;

final class FakeVcsApi {

	public ?string $pattern = null;

	public function enableReleaseAssets( string $pattern ): void {
		$this->pattern = $pattern;
	}
}

final class FakeChecker {

	public ?string $branch = null;
	public mixed $token    = null;
	public FakeVcsApi $api;

	public function __construct() {
		$this->api = new FakeVcsApi();
	}

	public function setBranch( string $branch ): void {
		$this->branch = $branch;
	}

	public function setAuthentication( string $token ): void {
		$this->token = $token;
	}

	public array $releaseFilter = array();

	public function setReleaseVersionFilter( string $regex, int $types, int $max ): void {
		$this->releaseFilter = array( $regex, $types, $max );
	}

	public function getVcsApi(): FakeVcsApi {
		return $this->api;
	}
}

final class FakeFactory {

	public static ?FakeChecker $last = null;
	public static array $args        = array();

	public static function buildUpdateChecker( string $repository, string $file, string $slug ): FakeChecker {
		self::$args = array( $repository, $file, $slug );
		self::$last = new FakeChecker();

		return self::$last;
	}
}

final class UpdaterTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		FakeFactory::$last = null;
		FakeFactory::$args = array();

		Functions\when( 'get_site_option' )->justReturn( array() );
	}

	public function test_default_source(): void {
		$source = ( new Updater( '/p/plugin.php', FakeFactory::class ) )->source();

		$this->assertSame( 'https://github.com/Kotlinski95/kotlinskidev-accessibility-plugin/', $source['repository'] );
		$this->assertSame( 'kotlinskidev-accessibility', $source['slug'] );
		$this->assertSame( '/kotlinskidev-accessibility\.zip/', $source['asset_pattern'] );
		$this->assertSame( 'main', $source['branch'] );
	}

	public function test_source_is_filterable_and_invalid_values_fall_back(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_update_source' )->once()->andReturn(
			array(
				'repository' => 'https://updates.example.test/',
				'slug'       => 42,
				'branch'     => '',
			)
		);

		$source = ( new Updater( '/p/plugin.php', FakeFactory::class ) )->source();

		$this->assertSame( 'https://updates.example.test/', $source['repository'] );
		$this->assertSame( 'kotlinskidev-accessibility', $source['slug'] );
		$this->assertSame( 'main', $source['branch'] );
	}

	public function test_register_builds_checker_with_release_assets(): void {
		$checker = ( new Updater( '/p/plugin.php', FakeFactory::class ) )->register();

		$this->assertSame( FakeFactory::$last, $checker );
		$this->assertSame(
			array( 'https://github.com/Kotlinski95/kotlinskidev-accessibility-plugin/', '/p/plugin.php', 'kotlinskidev-accessibility' ),
			FakeFactory::$args
		);
		$this->assertSame( 'main', $checker->branch );
		$this->assertSame( '/kotlinskidev-accessibility\.zip/', $checker->api->pattern );
		$this->assertNull( $checker->token );
	}

	public function test_token_only_comes_from_filter(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_update_token' )->once()->andReturn( 'secret' );

		$checker = ( new Updater( '/p/plugin.php', FakeFactory::class ) )->register();

		$this->assertSame( 'secret', $checker->token );
	}

	public function test_missing_checker_class_is_a_quiet_no_op(): void {
		$this->assertNull( ( new Updater( '/p/plugin.php', 'Missing\\Factory' ) )->register() );
		$this->assertNull( FakeFactory::$last );
	}

	private function updater( ?string $channel = null, array $constants = array() ): Updater {
		$lookup = static fn ( string $name ): mixed => $constants[ $name ] ?? null;

		return new Updater( '/p/plugin.php', FakeFactory::class, new Channel( $lookup ), $lookup );
	}

	public function test_disable_constant_returns_null(): void {
		$this->assertNull( $this->updater( null, array( 'KOTLINSKIDEV_A11Y_DISABLE_UPDATER' => true ) )->register() );
		$this->assertNull( FakeFactory::$last );
	}

	public function test_enable_filter_false_returns_null(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_enable_updater' )->once()->andReturn( false );

		$this->assertNull( $this->updater()->register() );
		$this->assertNull( FakeFactory::$last );
	}

	public function test_stable_channel_keeps_default_release_filtering(): void {
		$checker = $this->updater()->register();

		$this->assertSame( array(), $checker->releaseFilter );
	}

	public function test_beta_channel_includes_prereleases_with_strict_regex(): void {
		$checker = $this->updater( null, array( 'KOTLINSKIDEV_A11Y_UPDATE_CHANNEL' => 'beta' ) )->register();

		$this->assertSame( array( Updater::VERSION_PATTERN, 3, 20 ), $checker->releaseFilter );
	}

	public function test_version_pattern_accepts_only_release_shapes(): void {
		foreach ( array( '1.0.0', '1.0.0-beta.1', '1.0.0-rc.12' ) as $ok ) {
			$this->assertSame( 1, preg_match( Updater::VERSION_PATTERN, $ok ), $ok );
		}

		foreach ( array( 'v1.0.0', '1.0', '1.0.0-alpha.1', '1.0.0-beta', '1.0.0-beta.1.2', '1.0.0 ', '../1.0.0', '1.0.0-beta.1x', "1.0.0\n", "1.0.0-beta.1\n" ) as $bad ) {
			$this->assertSame( 0, preg_match( Updater::VERSION_PATTERN, $bad ), $bad );
		}
	}

	public function test_version_order(): void {
		$this->assertTrue( version_compare( '1.0.0-beta.1', '1.0.0-rc.1', '<' ) );
		$this->assertTrue( version_compare( '1.0.0-rc.1', '1.0.0', '<' ) );
		$this->assertTrue( version_compare( '1.0.0-beta.2', '1.0.0-beta.1', '>' ) );
		$this->assertTrue( version_compare( '1.0.0', '0.4.0', '>' ) );
	}

	public function test_reset_state_clears_checker_and_release_cache(): void {
		$deleted = array();

		Functions\when( 'delete_site_option' )->alias(
			function ( string $name ) use ( &$deleted ): bool {
				$deleted[] = $name;

				return true;
			}
		);
		Functions\when( 'delete_site_transient' )->alias(
			function ( string $name ) use ( &$deleted ): bool {
				$deleted[] = $name;

				return true;
			}
		);

		$this->updater()->reset_state();

		$this->assertSame( array( 'external_updates-kotlinskidev-accessibility', 'update_plugins', 'kotlinskidev_a11y_releases' ), $deleted );
	}

	public function test_github_repository_only_for_https_github(): void {
		Functions\when( 'wp_parse_url' )->alias( static fn ( string $url ): mixed => parse_url( $url ) );

		$this->assertSame( 'Kotlinski95/kotlinskidev-accessibility-plugin', $this->updater()->github_repository() );

		Filters\expectApplied( 'kotlinskidev_a11y_update_source' )->once()->andReturn( array( 'repository' => 'https://updates.example.test/a/b/' ) );
		$this->assertNull( $this->updater()->github_repository() );
	}
}
