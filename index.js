const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const path = require("path");
const fs = require("fs");
const app = express();
const httpserver = http.Server(app);
const io = socketio(httpserver);
var mime = require("mime-types");
const date = require("date-and-time");
var Filter = require('bad-words');
var customFilter = new Filter({ placeHolder: '*'});
var CleanCSS = require('clean-css');
var minify = require('html-minifier').minify;


app.get("/", function (req, res, next) {
  next();
});
var myLogger = function (req, res, next) {
  console.log("LOGGED");
  next();
  var url = __dirname + "/public" + req.url || "";
  if (url.endsWith("/") || !url.includes(".")) {
    url += "/";
    url = url + "index.html";
  }
  console.log(url);
	var isPoll = false;
  if (
    url.includes("/v/") &&
    url !== "/home/runner/beta/public/v/style.css" &&
    url !== "/home/runner/beta/public/v/app.js"
  ) {
		isPoll = true;
    var $_GET = url.split("/v/");
    req.query.id = $_GET[1];
    req.query.embed = "true";
    url = $_GET[0] + "/v/index.html";
    url = url;
  }
	if (
    url.includes("/e/") &&
    url !== "/home/runner/beta/public/v/style.css" &&
    url !== "/home/runner/beta/public/v/app.js"
  ) {
		isPoll = true;
    var $_GET = url.split("/e/");
    req.query.id = $_GET[1];
    url = $_GET[0] + "/v/index.html";
    url = url;
  }
  if (url.includes("/r/")) {
		isPoll = true;
    var $_GET = url.split("/r/");
    req.query.results = $_GET[1];
    url = $_GET[0] + "/v/index.html";
    url = url;
  }
	if (url.includes("/j/")) {
    var $_GET = url.split("/j/");
    req.query.id = $_GET[1];
    url = $_GET[0] + "/add/index.html";
    url = url;
  }
  // console.log(path.extname(url))
  res.setHeader("Content-Type", mime.lookup(path.extname(url)));
	var content = fs.readFileSync(url, { encoding: "utf-8" }).toString();
	if(isPoll == true) {
		var dbPolls = JSON.parse(fs.readFileSync(__dirname + "/public/database/polls.json"));
		// console.log($_GET[1].replace(/\D/g,''))
		var id = $_GET[1].replace(/\D/g,'');
		console.log(dbPolls[id])
		if(dbPolls[id]) {
			content = content.split("${__vars/title}").join( dbPolls[id].title);
			content = content.split("${__vars/description}").join(dbPolls[id].desc);
			content = content.split("${__vars/id}").join(id);
		}
		
	}
	console.log(path.extname(url))
	if(path.extname(url) == ".css") {
		var input = content;
		var options = { /* options */ };
		content = new CleanCSS(options).minify(input).styles
	}
	else if(path.extname(url) == ".html") {
		var result = minify(content, {
			removeAttributeQuotes: true,
			minifyJS: true,
			collapseWhitespace: true,
			continueOnParseError: true,
			minifyCSS: true,
		});
		content = result.trim().replace(/(\r\n|\n|\r)/gm, "");
	}
	else if(path.extname(url) == ".js") {
		var result = minify(`<script id="DEL_TAG_SCRIPT">
		${content}
		</script>`, {
			minifyJS: true,
		});
		result = result.replace(`<script id="DEL_TAG_SCRIPT">`, "")
		result = result.replace(`</script>`, "")
		content = result.trim().replace(/(\r\n|\n|\r)/gm, "");
	}
  res.send(content);
  console.log(req.query);
  res.end();
};
app.use(myLogger);
httpserver.listen(3000);

// const io = require("socket.io")(3000);

io.on("connection", (socket) => {
  socket.on("addPoll", (name, options, categories, desc) => {
    console.log(name, options, categories);
    var db = JSON.parse(fs.readFileSync("./public/database/polls.json"));
    var categories1 = [];
    var options1 = [];
    categories.split(",").forEach((data) => {
      categories1.push(customFilter.clean(data.trim()));
    });
    options.split("\n").forEach((data) => {
      options1.push({
        name: customFilter.clean(data),
        votes: 0,
      });
    });
    var testRowIndex =
      db.push({
        title: customFilter.clean(name),
        date: `${date.format(new Date(), "ddd, MMM DD YYYY")}`,
        categories: categories1,
        options: options1,
        desc: customFilter.clean(desc),
      }) - 1;
    // then you can access that item like this
    var item = db[testRowIndex];
    console.log(item, testRowIndex);
		fs.writeFileSync(
      "./public/database/polls.json",
      JSON.stringify(db),
      "utf-8"
    );
    io.emit("newPollAdded", testRowIndex);
    
  });
  socket.on("votedNow", function (a, b) {
    console.log("votedNow");
    io.emit("votedNow", a, b);
  });
  socket.on("vote", (optionID, pollID) => {
    console.log(optionID);
    io.emit("vote", optionID);
    var db = JSON.parse(
      fs.readFileSync("./public/database/polls.json", "utf-8")
    );
    if (db && pollID && db[pollID] && db[pollID].options[optionID]) {
      db[pollID].options[optionID].votes += 1;
      console.log(db[pollID].options[optionID].votes);
      fs.writeFileSync(
        "./public/database/polls.json",
        JSON.stringify(db),
        "utf-8"
      );
    }
    io.emit("votedNow", pollID, db[pollID].options);
  });
});
