var express = require('express');
var app = express();
var bodyParser = require('body-parser');


var port = process.env.PORT || 3000;


app.use(express.static('dist'));
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/tags',express.static('tags'));
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/pages',express.static('pages'));
app.use(bodyParser.urlencoded({ extended: true }));


var server = app.listen(port, function() {
  var host = server.address().address;
  var port = server.address().port;

  console.log("Listening on " + host + ":" + port);
});