<menu>
<div>
<p each={choice,index in choices} class={ selected: choice[2] } onclick={ clickChoice }><a onclick={ clickChoice }>{ choice[0] }</a></p>
<br/>

<a href="http://github.com/vineel/riot-cookbook-app/blob/master/pages/{ chosenTagName }.tag" target="source_view">View Source</a>

</div>

	<script>
		var thisTag = this;
		thisTag.chosenTagName = "";

		clickChoice(e) {
			thisTag.deselectAll();
			e.item.choice[2] = true;
			riot.route("/pages/" + e.item.choice[1]);
		}

		thisTag.deselectAll = function() {
			thisTag.choices.forEach(function(choice) {
				choice[2] = false;
			});
		}

		thisTag.choices = [
			["Welcome", "overview-page", false],
			["A Simple Tag", "simple-page", false],
			["A Boilerplate Tag", "boilerplate-page", false],
			["Routing", "routing-page", false],
			["Tables", "rendering-tables-page",false],
			["Ajax Table", "ajax-page", false],
			["Clicking", "click-page", false],
			["Accessing DOM", "getdom-page", false],
			["Between Tags", "between-page", false],
			["Building This App", "building-page", false]
		];

		thisTag.selectByIndex = function(index) {
			thisTag.deselectAll();
			thisTag.choices[index][2] = true;
			thisTag.chosenTagName = thisTag.choices[index][1];
			thisTag.update();
		}

		thisTag.selectByTag = function(tag) {
			thisTag.choices.forEach(function(choice, index) {
				if (tag === choice[1]) {
					thisTag.selectByIndex(index);
				}
			})
		}
	</script>

	<style scoped>

	div {
		width:100%;
		color:#000;
		margin:0;
		padding:0;
		max-width: 200px;
	}
	p {
		padding: 0;
		margin: 0;
		padding-left:10px;
		height:50px;
		cursor: pointer;
	}
	a, a:visited, a:hover {
		font-family: Helvetica, Arial;
		font-size:16px;
		padding:0;
		margin:0;
		position: relative;
		top:10px;
		left:20px;
		display: table-cell;
		cursor: pointer
	}

	p.selected {
		background-color: #000;
	}
	p.selected a, p.seleced a:visited {
		color:#fff;
	}
	</style>
</menu>