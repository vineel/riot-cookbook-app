<app>
	<h1>A Riot Cookbook App</h1>
	<div class="flexbox-container">
		<div class="left">
			<menu></menu>
		</div>
		<div class="right">
			<div id="content"></div>
		</div>
	</div>

	<script>
		// keep a reference to this tag across all contexts
		var thisTag = this;

		// tell riot router to start routing
		riot.route.start(true);

		// tell riot router to make urls that look like this:
		// http://localhost:3000/#/...
		riot.route.base('#/')


		thisTag.on('mount', function() {
			// tell index URL to redirect to the overview page URL
			riot.route('/', function() {
				riot.route('/pages/overview-page');
			});

			// capture any URL that lookslike /pages/sometag and set tagName to sometag
			riot.route('/pages/*', function(tagName) {
				// create instance of tag and insert it into the "content" div
				riot.mount(thisTag.content, tagName, null);

				// tell the menu tag to set the selection correctly
				thisTag.tags.menu.selectByTag(tagName);
			});

			riot.route('/source..', function() {
				var fname = riot.route.query().filename;
				riot.mount(thisTag.content, 'code-display', { filename: fname });
				
			});
		});

		viewSource(event) {
			riot.mount(thisTag.content, 'code-display', {filename: 'pages/boilerplate-page.tag'});
		}
	</script>
	<style>
		/* Global Style */
		body {
	      line-height:30px;
	      font-family: Helvetica, Arial;
	      font-size:16px;
		}
		p {
			margin-bottom:20px;
		}

		a, a:visited, a:hover {
			color: #00A;
			cursor: pointer;
		}


	</style>
	<style scoped>
	div {
		padding:0;
		margin:0;
		vertical-align: top;
	}
	menu {
		padding:0;
		margin:0;
	}
	h1 {
		margin-left: 20px;
	}
	.flexbox-container {
		display: -ms-flex;
		display: -webkit-flex;
		display: flex;
	}

	.left {
		width: 20%;
		max-width:200px;
		padding:0;
		margin:0 20px 0 0;
		vertical-align: top;
		min-height:600px;
		background-color: #fff;
		border-right:1px solid #eee;
	}

	.right {
		width:80%;
		margin-right: 20px;
	}
	ol li {
		margin-bottom: 20px;
	}
	</style>
</app>