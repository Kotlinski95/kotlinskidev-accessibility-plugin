<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Update;

use Brain\Monkey\Filters;
use Kotlinskidev\A11y\Tests\TestCase;
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
}
