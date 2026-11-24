<?php
return array(
	'abi'     => 1,
	'scripts' => array(
		'loader'      => array( 'file' => 'loader.js', 'ver' => '0123456789ab', 'raw' => 4200, 'gzip' => 1900 ),
		'kernel'      => array( 'file' => 'kernel.js', 'ver' => 'aaaaaaaaaaaa', 'raw' => 9000, 'gzip' => 2800 ),
		'panel'       => array( 'file' => 'panel.js', 'ver' => 'bbbbbbbbbbbb', 'raw' => 20000, 'gzip' => 6000 ),
		'content'     => array( 'file' => 'content.js', 'ver' => 'cccccccccccc', 'raw' => 11000, 'gzip' => 3600 ),
		'color'       => array( 'file' => 'color.js', 'ver' => 'dddddddddddd', 'raw' => 3000, 'gzip' => 1100 ),
		'orientation' => array( 'file' => 'orientation.js', 'ver' => 'eeeeeeeeeeee', 'raw' => 8000, 'gzip' => 2800 ),
	),
	'styles'  => array(
		'page'     => array( 'file' => 'frontend.css', 'ver' => 'ffffffffffff', 'raw' => 6000, 'gzip' => 1600 ),
		'launcher' => array( 'file' => 'launcher.css', 'ver' => '111111111111', 'raw' => 1300, 'gzip' => 600 ),
	),
	'inline'  => array(
		'bootstrap' => array( 'file' => 'bootstrap.js', 'ver' => '222222222222', 'raw' => 1500, 'gzip' => 700 ),
	),
);
