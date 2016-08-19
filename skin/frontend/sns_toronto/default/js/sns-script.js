jQuery(document).ready(function($){
	
	if($(window).width() >= 768) setHeight(Array("#sns_botsl .block-subscribe", "#sns_botsl #contact_gmap"), true);
	$(window).resize(function(){
		if($(window).width() >= 768){
			setHeight(Array("#sns_botsl .block-subscribe", "#sns_botsl #contact_gmap"), true);
		} else {
			setHeight(Array("#sns_botsl .block-subscribe", "#sns_botsl #contact_gmap"), false);
		}
	});
	
	if($('#sns_menu') && KEEP_MENU == 1){
		$('#sns_menu').stick_in_parent({
			sticky_class: 'keep-menu'
		});
	}
	$(window).load(function(){

	});
	
	$(document).on('click', '.item-img', function(){
		var $imgContainer = $(this);
		var $mainImg = $imgContainer.find('.image-main img');
		$imgContainer.find('.gallery img').each(function(){
			$(this).on('click', function(){
				$imgContainer.find('.gallery img').removeClass('active');
				$(this).addClass('active');
				$mainImg.attr('src', $(this).attr('data-src'));
			})
		});
	});

});