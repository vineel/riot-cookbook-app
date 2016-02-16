<traffic-light-notify>
	<div id="traffic">
		<div class={ red: lit==0, dark: lit!=0 }><p>STOP</p></div>
		<div class={ yellow: lit==1, dark: lit!=1 }><p>SLOW<p></div>
		<div class={ green: lit==2, dark: lit!=2 }><p>GO</p></div>
	</div>

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

	<style scoped>
	#traffic {
		display: -ms-flex;
		display: -webkit-flex;
		display: flex;
		padding:0;
		margin:0;
		border-radius: 10px;
		width:360px;
		border: 1px solid #000;
	}
	#traffic div {
		width:100px;
		height:100px;
		margin:10px;
		border-radius: 50px;
		
		display: table;
	}
	#traffic div p {
		text-align: center;
		vertical-align: middle;
		display: table-cell;
	}
	#traffic div.dark {
		background-color:#525252;		
	}

	#traffic div.red {
		background-color: #FF5468;
	}

	#traffic div.yellow {
		background-color: #FABE4D;
	}

	#traffic div.green {
		background-color: #4DFA90;
	}
	</style>
</traffic-light-notify>