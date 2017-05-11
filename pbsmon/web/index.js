
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

function jobsbyhostname(jobs, hostname) {
	return jobs.filter(function(j){
		var exec_host = j["exec_host"] || "";
		return exec_host.split('/')[0] == hostname && j["job_state"] == "R";
	});
}	

var jobcolor = function() {
	var map = {};
	var mapsize = 0;
	var scale = d3.scaleOrdinal(d3.schemeCategory20);
	return function(job) {
		var i = -1;
		var usr = job["user"];
		if (usr in map) {
			i = map[usr];
		} else {
			i = mapsize++;
			map[usr] = i;
		}
		var color =  scale(i);
		if (job["resources_used.cpupercent"]/job["resource_list.ncpus"] < 50) {
			color = d3.color(color).brighter().rgb();
		}
		return color;
	}
}();

function serversgraph(nodes, jobs) {
	var nodes = d3.select("body")
		.selectAll("svg")
		.data(nodes)
		.enter().append("svg")
			.attr("height", 125)
			.attr("width", 103);
	
	nodes.append("text")
			.attr("x", 5)
			.attr("y", 20)
			.attr("stroke", "#444")
		.text(function(d){ return d["hostname"]; });
	
	nodes.each(function(n) {
		var jobtip = d3.tip().attr("class", "d3-tip").html(function (d) {
			console.log(d);
			return "<div>" + 
				"User: " + d["user"] + "<br />" +
				"Id: " + d["id"] + "<br />" +
				"CPU Time: " + d["resources_used.cput"] + " / " + d["resource_list.cput"] + "<br />" +
				"Wall Time: " + d["resources_used.walltime"] + " / " + d["resource_list.walltime"] + "<br />" +
				"CPU: " + d["resources_used.cpupercent"] + "%" + "</br />"
				"Memory: " + d["resources_used.mem"] + " / " + d["resource_list.mem"] + "<br />" +
				"Virtual Memory: " + d["resources_used.vmem"] + " / " + d["resource_list.vmem"] + "<br />" +
				"Physical Memory: " + d["resources_used.pmem"] + " / " + d["resource_list.pmem"] + "<br />" +
				"</div>";
		});

		d3.select(this).call(jobtip);

		var j = d3.select(this)
			.selectAll("g.job")
			.data(jobsbyhostname(jobs, n["hostname"]))
			.enter().append("g")
				.attr("class", "job")
				.attr("transform", "translate(0, 25)")
				.attr("fill", function (d) { return jobcolor(d); })
			.on("mouseover", function(jb) {
				d3.select(this).attr("opacity", ".7");
				jobtip.show(jb);
			})
			.on("mouseout", function(jb) {
				d3.select(this).attr("opacity", "1");
				jobtip.hide(jb);
			})
			;
		j.exit().remove();

		j.selectAll("rect")
			.data(function (d, i) { return d3.range(i, i+d["resource_list.ncpus"] || 0); })
			.enter().append("rect")
				.attr("width", 25)
				.attr("height", 25)
				.attr("stroke", "#444")
				.attr("stroke-width", ".04em")
				.attr("x", function(d) { return (d % 4) * 25; })
				.attr("y", function(d) { return Math.floor((d)/4) * 25; })
			.exit().remove()
			;

		// add the not used cores
		d3.select(this)
			.selectAll("rect.unused")
			.data(d3.range(n["resources_assigned.ncpus"], n["resources_available.ncpus"]))
			.enter().append("rect")
				.attr("class", "unused")
				.attr("transform", "translate(0, 25)")
				.attr("fill", "none")
				.attr("stroke", "#444")
				.attr("stroke-width", ".04em")
				.attr("width", 25)
				.attr("height", 25)
				.attr("x", function(d) { return (d % 4) * 25; })
				.attr("y", function(d) { return Math.floor(d/4) * 25; })
			.exit().remove()
			;
	});
}

function showgraph() {
	d3.json("/jobs.json", function(jobs) {
		d3.json("nodes.json", function(nodes) {
			serversgraph(nodes, jobs);
		});
	});
}

window.onload = function(e) {
	showgraph();
	setInterval(showgraph, 180000);
}
