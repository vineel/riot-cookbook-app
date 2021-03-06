<building-page>
	<div>
		<p>This entire app is a simple example of creating a riotjs app using very minimal tooling.</p>
		<div style="background-color:#f5f2f0;padding:20px">
			<h3 style="padding:0;margin:0">How This App Works</h3>
			<h4>Build-time</h4>
			<ol>
				<li>Each tag is stored in a file of its own.</li>
				<li>Each tag has is referenced in the file <b>browserify_entrypoint.js</b>.</li>
				<li>The tool <a href="http://browserify.org/"><b>browserify</b></a> is run on <b>browserify_entrypoint.js</b>. This pulls the source of each referenced file (and any files that they reference) into one, concatenated file: <b>"/dist/js/main.bundle.js"</b></li>
				<li>The <b>/dist</b> directory contains the static assets served by the server. A simple static HTTP server is referenced in the package.json file.</li>
				<li>This process is defined by Gulpfile.js and is run using <a href="http://gulpjs.com/">gulp</a>.
				</li>
			</ol>
			<h4>Runtime</h4>
			<ol>
				<li>The user requests the <b>index.html</b> page.</li>
				<li>When the browser displays index.html, it downloads and runs <b>main.bundle.js</b>.</li>
				<li>In doing so, all tags are defined and then the code in <b>browserify_entrypoint.js</b>  is run.</li>
				<li>The last line in browserify_entrypoint.js is run, which is <b>riot.mount('*')</b>. This mounts the app tag.</li>
				<li>View the source of <a href="http://github.com/vineel/riot-cookbook-app/blob/master/dist/index.html">index.html</a>.</li>
			</ol>
		</div>
		<h3>How to install and this app:</h3>
		<p>First make sure you have <a href="https://git-scm.com/downloads">git</a> and <a href="http://nodejs.org">node</a> and npm.</p>
		<code-display filename="examples/build-ex1.html" lang="html"></code-display>
	</div>

</building-page>