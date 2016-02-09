<code-content>
	<div>
	<input type='text' value='<yield/>'>
	</div>
	<script>
		var codeText = "";

		this.on('before-mount', function() {
			// codeText = this.tags.code.innerHTML;
			// this.tags.code.innerHTML = ""
			// console.log(codeText);
		})
	</script>
</code-content>