<script>
	var thisTag = this;
	thisTag.lit = 0;

	thisTag.next = function() {
		thisTag.lit += 1;
		if (thisTag.lit > 2) {
			thisTag.lit = 0;
		}
		thisTag.update();
	}	
</script>
