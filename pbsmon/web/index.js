
function fetchjobs(cb) {
	load = function () {
		jobs = JSON.parse(this.responseText);
		cb(jobs);
	}
	xhr = new XMLHttpRequest();
	xhr.addEventListener("load", reqListener);
	xhr.open("GET", "/jobs.json");
	xhr.send();
}

function serversgraph(nodes, jobs) {
	var nodes = d3.select("body")
		.selectAll("svg")
		.data(nodes)
		.enter().append("svg")
			.attr("height", 125)
			.attr("width", 100);
	
	nodes.append("text")
			.attr("x", 5)
			.attr("y", 20)
			.attr("stroke", "#666")
		.text(function(d){ console.log(d); return d["hostname"]; });
	
	var cores = nodes.append("g")
			.attr("transform", "translate(0, 25)")
			.attr("fill", "none")
			.attr("stroke", "#aaa")
		.selectAll("rect")
		.data(function (d) { return d3.range(0, d["resources_assigned.ncpus"]); })
		.enter().append("rect")
			.attr("width", 25)
			.attr("height", 25)
			.attr("fill", "#eeaaaa")
			.attr("x", function(d) { console.log("painting red"); return (d % 4) * 25; })
			.attr("y", function(d) { return Math.floor(d/4) * 25; })
		.exit().remove()
		.data(function (d) { return d3.range(d["resources_assigned.ncpus"]-1, d["resources_available.ncpus"]); })
		.enter().append("rect")
			.attr("width", 25)
			.attr("height", 25)
			.attr("x", function(d) { console.log("painting white"); return (d % 4) * 25; })
			.attr("y", function(d) { return Math.floor(d/4) * 25; })
		.exit().remove();
	
	nodes.selectAll("g")
		.append("line")
			.attr("fill", "none")
			.attr("stroke", "#000")
			.attr("x1", function(d) { return Math.min(d["resources_available.ncpus"], 4)*25 })
			.attr("y1", 0)
			.attr("x2", function(d) { return Math.min(d["resources_available.ncpus"], 4)*25 })
			.attr("y2", function(d) { return Math.floor(d["resources_available.ncpus"]/4)*25 })
		;
}


function showgraph() {
	d3.json("/jobs.json", function(jobs) {
		d3.json("nodes.json", function(nodes) {
			serversgraph(nodes, jobs);
		});
	});
}

window.onload = function(e) {
	console.log("showing graph");
	showgraph();
}
