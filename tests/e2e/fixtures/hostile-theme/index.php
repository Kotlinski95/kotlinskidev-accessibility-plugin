<!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<div id="hostile-wrapper">
	<header id="hostile-header">
		<strong>Hostile fixture</strong>
		<a href="#hostile-footer">Footer</a>
		<button type="button" id="open-dialog">Open dialog</button>
	</header>
	<main id="hostile-main">
		<h1>Hostile fixture page</h1>
		<form id="hostile-form" onsubmit="return false">
			<label for="hostile-field">Name</label>
			<input id="hostile-field" type="text">
			<button type="submit">Send</button>
		</form>
		<div id="hostile-carousel">
			<div>Slide 1</div><div>Slide 2</div><div>Slide 3</div><div>Slide 4</div>
		</div>
		<iframe id="hostile-iframe" title="Embedded fixture" width="300" height="100" srcdoc="<p>Framed content</p>"></iframe>
		<video id="hostile-video" width="64" height="48" muted autoplay loop playsinline src="<?php echo esc_url( get_theme_file_uri( 'clip.mp4' ) ); ?>"></video>
		<img id="hostile-bg-image" alt="" width="160" height="90" src="data:image/svg+xml;utf8,&lt;svg xmlns='http://www.w3.org/2000/svg' width='160' height='90'&gt;&lt;rect width='160' height='90' fill='%23396'/&gt;&lt;/svg&gt;">
		<?php for ( $index = 0; $index < 700; $index++ ) : ?>
		<article class="hostile-article">
			<h3>Article <?php echo (int) $index; ?></h3>
			<p>Body <span>text</span> with <a href="#hostile-footer">a link</a> number <?php echo (int) $index; ?>.</p>
		</article>
		<?php endfor; ?>
	</main>
	<footer id="hostile-footer"><p>Hostile footer</p></footer>
</div>
<div id="hostile-fixed">Fixed badge</div>
<div id="cookie-wall" role="region" aria-label="Cookie consent">
	<div class="cookie-card">
		<p>We use cookies.</p>
		<button type="button" id="cookie-accept">Accept</button>
	</div>
</div>
<dialog id="hostile-dialog" aria-label="Fixture dialog">
	<p>Modal content</p>
	<button type="button" id="close-dialog">Close</button>
</dialog>
<?php wp_footer(); ?>
<script>
document.getElementById('open-dialog').addEventListener('click', function () {
	document.getElementById('hostile-dialog').showModal();
});
document.getElementById('close-dialog').addEventListener('click', function () {
	document.getElementById('hostile-dialog').close();
});
window.setTimeout(function () {
	var late = document.createElement('div');
	late.id = 'late-node';
	late.textContent = 'Late appended node';
	document.body.append(late);
}, 400);
</script>
</body>
</html>
