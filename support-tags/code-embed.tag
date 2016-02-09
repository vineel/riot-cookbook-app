<code-embed>
	<pre><code class="language-markup">{ opts.content }</code></pre>
	<script>
		this.on('mount', function() {
			 Prism.highlightAll();
			 // Prism.highlightElement(this.tags.code);
		});
	</script>
	<style scoped>
	pre {
		margin:0;
		padding:10px;
	}
	</style>
</code-embed>