<script>
	var thisTag = this;
	var notificationCenter = riot.mixin('notificationcenter');
	thisTag.lit = 0;

	var next = function() {
		thisTag.lit += 1;
		if (thisTag.lit > 2) {
			thisTag.lit = 0;
		}
		thisTag.update();
	}

	notificationCenter.listenTo('next_light_state', function(tagId) {
		if (tagId && tagId != thisTag.opts.id) {
			return;
		}
		next();
	});

</script>
