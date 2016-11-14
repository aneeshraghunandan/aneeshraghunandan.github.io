$(document).ready(function() {

	var $this,
		folder = 'resources/img/';

	$('nav').delegate('a', 'click', function() {
		window.location.hash = $(this).attr("href");
		return false;
	});

	$(window).bind('hashchange', function() {

		if(!$('#content > div').is(':animated')) {

			newHash = (window.location.hash == '') ? '#about' : window.location.hash;

			if(newHash != $('nav a.active').attr('href')) {

				$('#content > div').hide();
				$(newHash).show();

				$('nav li').removeClass('active');
				$('nav a[href=' + newHash + ']').parent('li').addClass('active');

			}

		}

	}).trigger('hashchange');

});
