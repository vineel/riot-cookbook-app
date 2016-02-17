<boilerplate>
	<div>
		This is the HTML markup in the tag.
		{ a_tag_variable }
	</div>

	<script>
		var thisTag = this;

		thisTag.on('mount', function() {
			thisTag.a_tag_variable = "DOM is ready now!";
			thisTag.update();
		});
	</script>

	<style scoped>
		div {
			font-family: Helvetica, Arial;
			font-size:14px;
			background-color: #eee;
		}
	</style>
</boilerplate>