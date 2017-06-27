
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

var usermap = {}
var usermapsize = 0;
var jobcolor = function() {
	var scale = d3.scaleOrdinal(d3.schemeCategory20);
	return function(job) {
		var i = -1;
		var usr = job["user"];
		if (usr in usermap) {
			i = usermap[usr];
		} else {
			i = usermapsize++;
			usermap[usr] = i;
		}
		var color = d3.color(scale(i)).darker(.2);
		if (job["resources_used.cpupercent"]/job["resources_used.ncpus"] < 50) {
			color = color.brighter(.4);
		}
		return color.rgb();
	}
}();

var nodetip = d3.tip().attr("class", "d3-tip")
	.attr("class", "d3-tip")
	.offset([-5, 0])
	.html(function (d) {
		return "<div>" + 
			"State: " + d["state"] + "<br/>" +
			"Qlist: " + (d["resources_available.qlist"]||[]).join(', ') +
			"</div>";
	})
	.direction("n");

var jobtip = d3.tip().attr("class", "d3-tip")
	.attr("class", "d3-tip")
	.offset([15, 5])
	.html(function (d) {
		return "<div>" + 
			"User: " + d["user"] + "<br />" +
			"Id: " + d["id"] + "<br />" +
			"CPU Time: " + d["resources_used.cput"] + " / " + d["resource_list.cput"] + "<br />" +
			"Wall Time: " + d["resources_used.walltime"] + " / " + d["resource_list.walltime"] + "<br />" +
			"CPU: " + d["resources_used.cpupercent"] + "%" + " of " + d["resources_used.ncpus"] + " cores" + "</br />" +
			"Memory: " + d["resources_used.mem"] + " / " + d["resource_list.mem"] + "<br />" +
			"Virtual Memory: " + d["resources_used.vmem"] + " / " + d["resource_list.vmem"] + "<br />" +
			"Physical Memory: " + d["resources_used.pmem"] + " / " + d["resource_list.pmem"] + "<br />" +
			"</div>";
	})
	.direction("se");

var memtip = d3.tip()
	.attr("class", "d3-tip")
	.offset([-15, 0])
	.html(function (d) {
		var avail = d["resources_available.mem"];
		var used = d["resources_assigned.mem"];

		return "<div>" +
			used + "/" + avail +
			"</div>";
	});

function memratio(node) {
	var avail = node["resources_available.mem"];
	var used = node["resources_assigned.mem"];

	var meminbytes = function(memstr) {
		var units = memstr.slice(-2);
		var multiplier = 1;
		if (units == "kb") multiplier = 1000
		else if (units == "mb") multiplier = 1000*1000
		else if (units == "gb") multiplier = 1000*1000*1000
		else if (units == "tb") multiplier = 1000*1000*1000*1000
		return parseInt(memstr)*multiplier;
	}
	var ratio =  meminbytes(used)/meminbytes(avail);
	if (ratio < .05) ratio = .05;
	return ratio;
}

function serversgraph(nodes, jobs) {
	var body = d3.select("body");
	var nds = body
		.selectAll("svg.node")
		.data(nodes, function key(n){return n["hostname"];})
		;
	
	// create nodes with title text
	nds.enter().append("svg")
			.attr("class", function(d) {
				if (d["state"].includes("down"))
					return "node down";
				else
					return "node";
			})
			.attr("height", 145)
			.attr("width", 103)
		.append("text")
			.attr("x", 5)
			.attr("y", 20)
			.attr("stroke", "#444")
		.text(function(d){ return d["hostname"]; })
		.on("mouseover", nodetip.show)
		.on("mouseout", nodetip.hide)
		;

	nds.exit().remove();

	// update memory bars
	nds.select(".memory rect")
		.attr("width", function (d) { console.log(d); return 100*memratio(d); })
		;
	// create memory bars
	nds.enter().selectAll(".node").append("g")
			.attr("class", "memory")
			.attr("transform", "translate(0, 25)")
		.append("rect")
			.attr("x", 0)
			.attr("y", 0)
			.attr("width", function (d) { return 100*memratio(d); })
			.attr("height", 15)
			.attr("fill", "red")
		.on("mouseover", function(n){
			d3.select(this).attr("fill", d3.color("red").darker(.6));
			memtip.show(n);
		})
		.on("mouseout", function(n){
			d3.select(this).attr("fill", "red");
			memtip.hide(n);
		})
		;
	
	d3.selectAll(".node").each(function(n) {
		d3.select(this).call(memtip);
		d3.select(this).call(jobtip);
		d3.select(this).call(nodetip);

		var jbs = d3.select(this)
			.selectAll("g.job")
			.data(jobsbyhostname(jobs, n["hostname"]), function key(j){ return j["id"]; });

		var jbs_g = jbs.enter().append("g")
				.attr("class", "job")
				.attr("transform", "translate(0, 42)")
				.attr("stroke", "none")
				.attr("fill", function (d) { return jobcolor(d); })
				.attr("data-clipboard-text", function(d) { return d["id"]; })
			.on("mouseover", function(jb) {
				d3.select(this).attr("fill", function (d) { return d3.color(jobcolor(d)).brighter(.6); });
				var dright = window.innerWidth - d3.event.clientX;
				var dleft = d3.event.clientX;
				var ddown = window.innerHeight - d3.event.clientY;
				var dup = d3.event.clientY;
				var we = 'e'; var ns = 's';
				if (ddown < 300) {
					ns = 'n';
					if (dup < 300)
						ns = '';
				}
				if (dright < 300) {
					we = 'w';
					if (dleft < 300)
						we = '';
				}
				if (ns === '' && we === '') ns = 's';
				jobtip.direction(ns+we).show(jb);
			})
			.on("mouseout", function(jb) {
				d3.select(this).attr("fill", function (d) { return jobcolor(d); })
				jobtip.hide(jb);
			})
			;
		jbs.exit().remove();

		// draw all cpus every time
		counter = 0
		d3.select(this).selectAll(".job").selectAll("rect").remove();
		var cores = d3.select(this).selectAll(".job").selectAll("rect")
			.data(function (d) { var prev = counter; counter += (d["resources_used.ncpus"] || 0); return d3.range(prev, counter); })
			;
		cores.enter().append("rect")
				.attr("width", 25)
				.attr("height", 25)
				.attr("x", function(d) { return ((counter-d-1) % 4) * 25; })
				.attr("y", function(d) { return Math.floor((counter-d-1)/4) * 25; })
			;
		// STDIN jobs S tags
		jbs_g.append("text")
				.attr("stroke", "white")
				.attr("fill", "black")
				.attr("x", 3)
				.attr("y", 10)
				.attr("font-size", "10px")
				.attr("style", "font-weight: lighter;")
			.text(function(d) { return (d["job_name"] == "STDIN") ? "S" : ""; })

		// add the not used cores
		d3.select(this).selectAll("rect.cpus").remove();
		d3.select(this)
			.selectAll("rect.cpus")
			.data(d3.range(0, n["resources_available.ncpus"]))
			.enter().append("rect")
				.attr("class", "cpus")
				.attr("transform", "translate(0, 42)")
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
			new Clipboard(".job");
		});
	});
}

window.onload = function(e) {
	showgraph();
	setInterval(showgraph, 120000);
}
