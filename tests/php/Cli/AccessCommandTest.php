<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Cli;

use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Cli\AccessCommand;
use WP_CLI;

final class FakeRole {

	public function __construct( public array $caps = array() ) {}

	public function add_cap( string $capability ): void {
		$this->caps[ $capability ] = true;
	}

	public function remove_cap( string $capability ): void {
		unset( $this->caps[ $capability ] );
	}

	public function has_cap( string $capability ): bool {
		return ! empty( $this->caps[ $capability ] );
	}
}

final class AccessCommandTest extends CliTestCase {

	private array $roles = array();

	protected function setUp(): void {
		parent::setUp();

		$this->roles = array(
			'administrator' => new FakeRole( array( 'manage_options' => true ) ),
			'editor'        => new FakeRole(),
			'author'        => new FakeRole( array( 'kotlinskidev_a11y_customize' => true ) ),
		);

		Functions\when( 'get_role' )->alias( fn ( string $name ): ?FakeRole => $this->roles[ $name ] ?? null );
		Functions\when( 'wp_roles' )->alias( fn (): object => (object) array( 'role_objects' => $this->roles ) );
	}

	public function test_registers_three_commands_with_synopses(): void {
		AccessCommand::register();

		$this->assertSame( array( 'ka11y access grant', 'ka11y access revoke', 'ka11y access list' ), array_keys( WP_CLI::$commands ) );

		foreach ( WP_CLI::$commands as $registration ) {
			$this->assertNotEmpty( $registration['args']['synopsis'] );
		}
	}

	public function test_grant_adds_the_customer_capability(): void {
		( new AccessCommand() )->grant( array( 'editor' ) );

		$this->assertTrue( $this->roles['editor']->has_cap( 'kotlinskidev_a11y_customize' ) );
		$this->assertSame( 'Granted kotlinskidev_a11y_customize to role editor.', WP_CLI::$successes[0] );
	}

	public function test_grant_is_idempotent(): void {
		( new AccessCommand() )->grant( array( 'author' ) );

		$this->assertStringContainsString( 'Already granted', WP_CLI::$successes[0] );
	}

	public function test_revoke_removes_the_capability_only(): void {
		( new AccessCommand() )->revoke( array( 'author' ) );

		$this->assertFalse( $this->roles['author']->has_cap( 'kotlinskidev_a11y_customize' ) );
		$this->assertSame( 'Revoked kotlinskidev_a11y_customize from role author.', WP_CLI::$successes[0] );

		( new AccessCommand() )->revoke( array( 'editor' ) );

		$this->assertStringContainsString( 'Not granted', WP_CLI::$successes[1] );
		$this->assertTrue( $this->roles['administrator']->has_cap( 'manage_options' ) );
	}

	public function test_unknown_role_is_an_error(): void {
		$this->assertSame( 'Unknown role: ghost', $this->failure_of( fn () => ( new AccessCommand() )->grant( array( 'ghost' ) ) ) );
		$this->assertSame( 'Unknown role: ghost', $this->failure_of( fn () => ( new AccessCommand() )->revoke( array( 'ghost' ) ) ) );
		$this->assertStringContainsString( 'Unknown role', $this->failure_of( fn () => ( new AccessCommand() )->grant( array() ) ) );
	}

	public function test_list_shows_roles_with_the_effective_capability(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_customer_capability' )->andReturn( 'kotlinskidev_a11y_customize' );

		( new AccessCommand() )->list_roles( array(), array( 'format' => 'json' ) );

		$this->assertSame( 'json', WP_CLI::$tables[0]['format'] );
		$this->assertSame( array( array( 'role' => 'author', 'capability' => 'kotlinskidev_a11y_customize' ) ), WP_CLI::$tables[0]['items'] );
	}

	public function test_a_filtered_capability_is_the_one_shown_and_granted(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_customer_capability' )->andReturn( 'kotlinskidev_a11y_brand' );

		( new AccessCommand() )->grant( array( 'editor' ) );

		$this->assertTrue( $this->roles['editor']->has_cap( 'kotlinskidev_a11y_brand' ) );
		$this->assertStringContainsString( 'kotlinskidev_a11y_brand', WP_CLI::$successes[0] );
	}

	public function test_list_rejects_a_bad_format(): void {
		$this->assertStringContainsString( 'Invalid format', $this->failure_of( fn () => ( new AccessCommand() )->list_roles( array(), array( 'format' => 'csv' ) ) ) );
	}
}
