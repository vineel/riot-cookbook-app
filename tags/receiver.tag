<receiver>
	<div>
		This is a receiver.
		<rg-modal id="mymodal">Modal body</rg-modal>
	</div>

	<script>
	this.on('mount', function() {
		riot.mount('rg-modal', {
		  modal: {
		    isvisible: true,
		    dismissable: true,
		    heading: 'Modal heading',
		    buttons: [{
		      text: 'Ok',
		      type: 'primary',
		      action: function () { this.close(); }
		    }, {
		      text: 'Cancel',
		      action: function () { this.close(); }
		    }]
		  }
		});
		console.log("this.tags", this.tags.mymodal);
	});
	</script>
</receiver>