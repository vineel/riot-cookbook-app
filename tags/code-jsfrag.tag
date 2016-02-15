<code-jsfrag>
	<textarea><yield/></textarea>
	<script>
		var thisTag = this;
		var hljs = require('highlight.js');

		this.on('mount', function() {
			// console.log("txt", thisTag.txt.innerText);
			// hljs.highlightBlock(thisTag.display);
		});
	</script>
	<style scoped>
	pre#display {
		margin:0;
		padding:0;
		overflow: hidden;
		background-color: #f5f2f0; 
	}
	code {
		padding:20px;
		overflow: hidden;
	}
	</style>
</code-jsfrag>