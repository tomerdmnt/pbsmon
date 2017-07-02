
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
var usercolor = function() {
	var scale = d3.scaleOrdinal(d3.schemeCategory20);
	return function(user) {
		var i = -1;
		if (user in usermap) {
			i = usermap[user];
		} else {
			i = usermapsize++;
			usermap[user] = i;
		}
		var color = d3.color(scale(i)).darker(.2);
		return color;
	}
}();

var jobcolor = function(job) {
	var usr = job["user"];
	var color = usercolor(usr);
	if (job["resources_used.cpupercent"]/job["resources_used.ncpus"] < 50) {
		color = color.brighter(.4);
	}
	return color.rgb();
}

var nodetip = d3.tip().attr("class", "d3-tip")
	.attr("class", "d3-tip")
	.offset([0, 0])
	.html(function (d) {
		return '<div class="tip-text">' + 
			"<span>State:</span>" + d["state"] + "<br/>" +
			"<span>Qlist:</span>" + (d["resources_available.qlist"]||[]).join(', ') +
			"</div>";
	})
	.direction("n");

var jobtip = d3.tip().attr("class", "d3-tip")
	.attr("class", "d3-tip")
	.offset([0, 0])
	.html(function (d) {
		return '<div class="tip-text">' + 
			"<span>User:</span>" + d["user"] + "<br />" +
			"<span>Id:</span>" + d["id"] + "<br />" +
			"<span>CPU Time:</span>" + d["resources_used.cput"] + " / " + d["resource_list.cput"] + "<br />" +
			"<span>Wall Time:</span>" + d["resources_used.walltime"] + " / " + d["resource_list.walltime"] + "<br />" +
			"<span>CPU:</span>" + d["resources_used.cpupercent"] + "%" + " of " + d["resources_used.ncpus"] + " cores" + "</br />" +
			"<span>Memory:</span>" + d["resources_used.mem"] + " / " + d["resource_list.mem"] + "<br />" +
			"<span>Virtual Memory:</span>" + d["resources_used.vmem"] + " / " + d["resource_list.vmem"] + "<br />" +
			"<span>Physical Memory:</span>" + d["resources_used.pmem"] + " / " + d["resource_list.pmem"] + "<br />" +
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

function calctipdirection(distance_ns, distance_we, ns, we) {
	var dright = window.innerWidth - d3.event.clientX;
	var dleft = d3.event.clientX;
	var ddown = window.innerHeight - d3.event.clientY;
	var dup = d3.event.clientY;

	we = we || '';
	ns = ns || '';
	if (ddown < distance_ns) {
		ns = 'n';
		if (dup < distance_ns)
			ns = '';
	} else if (dup < distance_ns) {
		ns = 's';
	}
	if (dright < distance_we) {
		we = 'w';
		if (dleft < distance_we)
			we = '';
	} else if (dleft < distance_we) {
		we = 'e';
	}
	if (ns === '' && we === '') ns = 'n';
	return ns + we;
}

function cpuperrow(node) {
	var x = node["resources_available.ncpus"]/4;
	x = Math.ceil(x);
	x = Math.max(x, 4);
	return x;
}

function serversgraph(nodes, jobs) {
	var running = d3.select(".running");
	var nds = running
		.selectAll("svg.node")
		.data(nodes, function key(n){return n["hostname"];})
		;
	
	// create nodes with title text
	newnodes = nds.enter().append("svg")
			.attr("class", function(d) {
				if (d["state"].includes("down") || d["state"].includes("offline"))
					return "node down";
				else
					return "node";
			})
			.attr("height", 145)
			.attr("width", function(d){ console.log("updating nodes width"); return cpuperrow(d)*25 + 3; })
			;

	newnodes.append("text")
			.attr("x", 5)
			.attr("y", 20)
			.attr("stroke", "#444")
		.text(function(d){ return d["hostname"]; })
		.on("mouseover", function(n) {
			nodetip.direction(calctipdirection(50, 200, "n")).show(n);
		})
		.on("mouseout", function(n) {
			nodetip.hide();
		})
		;

	// create memory bars
	newnodes.append("g")
			.attr("class", "memory")
			.attr("transform", "translate(0, 25)")
		.append("rect")
			.attr("x", 0)
			.attr("y", 0)
			.attr("width", function (d) { return cpuperrow(d)*25*memratio(d); })
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
		// update memory bars
		.merge(nds).selectAll(".memory")
			.attr("width", function (d) { return cpuperrow(d)*25*memratio(d); })
		;
		;
	nds.exit().remove();
	
	d3.selectAll(".node").each(function(n) {
		d3.select(this).call(memtip);
		d3.select(this).call(jobtip);
		d3.select(this).call(nodetip);

		var jbs = d3.select(this)
			.selectAll("g.job")
			.data(jobsbyhostname(jobs, n["hostname"]), function key(j){ return j["id"]; });

		jbs.enter().append("g")
				.attr("class", function(d) { return d["job_name"] == "STDIN" ? "job stdin" : "job"; })
				.attr("transform", "translate(0, 42)")
				.attr("stroke", "none")
				.attr("fill", function (d) { return jobcolor(d); })
				.attr("data-clipboard-text", function(d) { return d["id"]; })
			.on("mouseover", function(jb) {
				d3.select(this).attr("fill", function (d) { return d3.color(jobcolor(d)).brighter(.6); });
				jobtip.direction(calctipdirection(250, 300, "s", "e")).show(jb);
			})
			.on("mouseout", function(jb) {
				d3.select(this).attr("fill", function (d) { return jobcolor(d); })
				jobtip.hide(jb);
			})
			.merge(jbs).select(".job")
				.attr("fill", function (d) { return jobcolor(d); })
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
				.attr("x", function(d) { return ((counter-d-1) % cpuperrow(n)) * 25; })
				.attr("y", function(d) { return Math.floor((counter-d-1)/cpuperrow(n)) * 25; })
			;

		// STDIN jobs mark with S tags
		d3.select(this).selectAll(".job.stdin rect")
			.attr("rx", 10)
			.attr("ry", 10);

		// add the unused cores
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
				.attr("x", function(d) { return (d % cpuperrow(n)) * 25; })
				.attr("y", function(d) { return Math.floor(d/cpuperrow(n)) * 25; })
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
