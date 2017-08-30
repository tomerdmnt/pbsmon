
var clipboard;
var snapshot = {
	isloaded: false,
	current: {}
}
var jobinfomodal;

// save a snapshot of the system to a local file
function savesnapshot() {
	var filename = "snapshot-" + new Date().getTime() + ".pbsmon";
	var file = new File([JSON.stringify(snapshot.current)], filename, {type: "text/plain;charset=utf-8"});
	saveAs(file, filename);
	d3.event.preventDefault();
}

// loads a snapshot of the system from a local file
function loadsnapshot() {
	snapshotloaded = true;
	var file = d3.event.target.files[0];
	var r = new FileReader();

	r.addEventListener("load", function(e) {
		var snapshot = JSON.parse(e.target.result);
		updatequeues(snapshot.jobs);
		updatenodes(snapshot.nodes, snapshot.jobs);
		updatealerts(snapshot.alerts)

		d3.select(".showingsnapshot")
			.text(" viewing " + file.name + "; click to go back")
			.on("click", function() {
				snapshotloaded = false;
				d3.select(this).text("");
				document.querySelector("#loadsnapshot").value = null;
				d3.event.preventDefault();
				updatedisplay();
			});
	});
	
	r.readAsText(file);
}

// returns all jobs running on hostname
// parses the exec_vnode job field and retrieves
// the number of cpus the jobs occupies on hostname
function jobsbyhostname(jobs, hostname) {
	return jobs.filter(function(j){
		res = false;
		if (j["job_state"] !== "R") {
			return false;
		}
		// parse the exec_vnode field to get all hosts
		// the job runs on
		var exec_vnode = j["exec_vnode"] || "";
		var vnodes = exec_vnode.split("+");
		vnodes.forEach(function(vn){
			vn = vn.substring(1, vn.length-1);
			var parts = vn.split(":");
			host = parts[0];
			if (host === hostname) {
				parts.forEach(function(p){
					var field = p.split("=");
					if (field[0] == "ncpus") {
						j["vnode_ncpus"] = parseInt(field[1]);
					}
					res = true;
				});
			}
		});
		return res;
	});
}

// returns a list of all users running jobs
function allusers(jobs) {
	return Array.from(new Set(jobs.map(function(j){
		return j["user"];
	}))).filter(function(u){ return u != undefined; });
}

// returns statistics of queued jobs and running jobs for the  user
function userqueuesstats(user, queues, jobs) {
	res = [];
	idx = 0;
	queues.forEach(function(q) {
		res.push({
			index: idx++,
			user: user,
			queue: q,
			running_cpus: jobs.reduce(function(sum, j){
						if (j["queue"] === q &&
							j["user"] === user &&
							j["job_state"] === "R") {
								return sum + j["resource_list.ncpus"];
							}
							return sum;
					}, 0),
			queued_cpus: jobs.reduce(function(sum, j){
						if (j["queue"] === q &&
							j["user"] === user &&
							j["job_state"] === "Q") {
								return sum + j["resource_list.ncpus"];
							}
							return sum;
					}, 0),
			running_jobs: jobs.reduce(function(sum, j){
						if (j["queue"] === q &&
							j["user"] === user &&
							j["job_state"] === "R") {
								return sum + 1;
							}
							return sum;
					}, 0),
			queued_jobs: jobs.reduce(function(sum, j){
						if (j["queue"] === q &&
							j["user"] === user &&
							j["job_state"] === "Q") {
								return sum + 1;
							}
							return sum;
					}, 0)
		});
	});
	return res;
}

// returns the color assigned to user
// if user is not in the usermap, assign it a new color
// and return it
var usercolor = function() {
	var usermap = {}
	var usermapsize = 0;
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

// returns the job's color according
// to the user running the job, and the cpu percent
var jobcolor = function(job) {
	var usr = job["user"];
	var color = usercolor(usr);
	if (job["resources_used.cpupercent"]/job["resources_used.ncpus"] < 50) {
		color = color.brighter(.4);
	}
	return color.rgb();
}

// returns the ratio between node's available memory and assigned memory
function memratio(node) {
	var avail = node["resources_available.mem"];
	var used = node["resources_assigned.mem"];

	var meminbytes = function(memstr) {
		if (!memstr) return 0;
		var units = memstr.slice(-2);
		var multiplier = 1;
		if (units == "kb") multiplier = 1000
		else if (units == "mb") multiplier = 1000*1000
		else if (units == "gb") multiplier = 1000*1000*1000
		else if (units == "tb") multiplier = 1000*1000*1000*1000
		return parseInt(memstr)*multiplier;
	}
	var ratio =  meminbytes(used)/meminbytes(avail);
	//if (ratio < .05) ratio = .05;
	return ratio;
}

// returns the number of cpus per row which should display for node
// the node always has 4 rows
function cpuperrow(node) {
	var x = node["resources_available.ncpus"]/4;
	x = Math.ceil(x);
	x = Math.max(x, 4);
	return x;
}

// nodes tooltip template
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

// jobs tooltip template
var jobtip = d3.tip().attr("class", "d3-tip")
	.attr("class", "d3-tip")
	.offset([0, 0])
	.html(function (d) {
		text = '<div class="tip-text">' + 
			"<span>User:</span>" + d["user"] + "<br />" +
			"<span>Id:</span>" + d["id"] + "<br />" +
			"<span>Job Name:</span>" + d["job_name"] + "<br />" +
			"<span>CPU Time:</span>" + d["resources_used.cput"] + " / " + d["resource_list.cput"] + "<br />" +
			"<span>Wall Time:</span>" + d["resources_used.walltime"] + " / " + d["resource_list.walltime"] + "<br />" +
			"<span>CPU:</span>" + d["resources_used.cpupercent"] + "%" + " of " + d["resources_used.ncpus"] + " cores" + "</br />" +
			"<span>Memory:</span>" + d["resources_used.mem"] + " / " + d["resource_list.mem"] + "<br />" +
			"<span>Virtual Memory:</span>" + d["resources_used.vmem"] + " / " + d["resource_list.vmem"] + "<br />" +
			"<span>Physical Memory:</span>" + d["resources_used.pmem"] + " / " + d["resource_list.pmem"] + "<br />";
		if (d["interactive"]) text += "<span></span>Interactive";
		text += "</div>";
		return text;
	})
	.direction("se");

// memory tooltip tempate
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

// returns the recommended direction (n, s, nw, ne, sw, se)
// of where to display a tooltip according to the distance
// from the edges of the screen
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

// update the queues table display
function updatequeues(jobs) {
	var queuesdiv = d3.select(".queues");
	var queues = Array.from(new Set(jobs.map(function(j){return j["queue"];})));
	queues = queues.filter(function(q){ return q != undefined; });

	// draw the table from scratch
	queuesdiv.selectAll("table").remove();

	var tbl = queuesdiv.append("table")
		.attr("align", "center");

	var thead = tbl.append("thead");
	var header = thead.append("tr");
	header.append("th");
	header.selectAll("th.queue")
		.data(queues).enter()
		.append("th")
			.attr("class", "queue")
			.attr("colspan", 2)
		.text(function(d) { return d; });

	var header2 = thead.append("tr");
	header2.append("th");
	header2.selectAll("th.state")
		.data(d3.range(0, queues.length*2)).enter()
		.append("th")
			.attr("class", "state")
		.text(function(d) { return d % 2 == 0 ? "queued" : "running"; });
	
	var userrow = tbl.append("tbody")
		.selectAll("tr")
		.data(allusers(jobs)).enter()
		.append("tr");
	
	userrow.append("td")
		.html(function(u){ return "<div class='color-box' style='background-color: " + usercolor(u) + "'></div> " + u;});
	
	var uq = userrow.selectAll("td.stats")
		.data(function(user) { return userqueuesstats(user, queues, jobs); }).enter();
	
	var td = uq.append("td")
			.attr("class", "stats")
			.attr("align", "center");
	td.append("span")
			.attr("class", "cpus")
		.html(function(d) { return d.queued_cpus; });
	td.append("span")
			.attr("class", "jobs")
		.html(function(d) { return d.queued_jobs; });
	td = uq.append("td")
			.attr("class", "stats")
			.attr("align", "center");
	td.append("span")
			.attr("class", "cpus")
		.html(function(d) { return d.running_cpus; });
	td.append("span")
			.attr("class", "jobs")
		.html(function(d) { return d.running_jobs; });
	
	tbl.append("tr")
		.append("td")
			.attr("colspan", queues.length*2+1)
		.append("a")
			.attr("class", "toggle")
			.attr("href", "#")
		.on("click", function togglejobscpus(e) {
			queuesdiv.classed("show_jobs", !queuesdiv.classed("show_jobs"));
			this.innerText = queuesdiv.classed("show_jobs") ? "# jobs" : "# cpus";
			d3.event.preventDefault();
		}).text("# cpus");
	
	uq.selectAll("td.stats").sort(function(a, b){return a.index - b.index;});
}

// update the nodes graph display
function updatenodes(nodes, jobs) {
	var running = d3.select(".running");
	d3.select(".cpuutil")
		.text(nodes.reduce(function(sum, n){ return sum + n["resources_assigned.ncpus"]; }, 0) + " of " +
			nodes.reduce(function(sum, n){ return sum + n["resources_available.ncpus"]; }, 0));

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
			.attr("width", function(d){ return cpuperrow(d)*25 + 3; })
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
	d3.selectAll(".node .memory")
		.data(nodes, function key(n){return n["hostname"];})
		;
	d3.selectAll(".node .memory .used")
		.data(nodes, function key(n){return n["hostname"];})
		;
	var memory_g = newnodes.append("g")
			.attr("class", "memory")
			.attr("transform", "translate(0, 25)")
		.on("mouseover", function(n){
			d3.select(this).selectAll("rect").each(function(r){
				d3.select(this).attr("fill", d3.color(d3.select(this).attr("fill")).darker(.3));
			});
			memtip.show(n);
		})
		.on("mouseout", function(n){
			d3.select(this).selectAll("rect").each(function(r){
				d3.select(this).attr("fill", d3.color(d3.select(this).attr("fill")).brighter(.3));
			});
			memtip.hide(n);
		})
		;
	memory_g.append("rect")
			.attr("x", 0)
			.attr("y", 0)
			.attr("width", function (d) { return cpuperrow(d)*25; })
			.attr("height", 13)
			.attr("fill", "#eee")
			.attr("stroke", "#333")
			.attr("stroke-width", ".02em")
		;
	memory_g.append("rect")
			.attr("class", "used")
			.attr("x", 0)
			.attr("y", 0)
			.attr("width", function (d) { return cpuperrow(d)*25*memratio(d); })
			.attr("height", 13)
			.attr("fill", "red")
		;
	nds.selectAll(".memory .used")
		.attr("width", function (d) { return cpuperrow(d)*25*memratio(d); })
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
				.attr("class", "job")
				.attr("transform", "translate(0, 42)")
				.attr("stroke", "none")
				.attr("fill", function (d) { return jobcolor(d); })
			.classed("stdin", function(d){return d["job_name"] == "STDIN";})
			.classed("interactive", function(d){return d["interactive"];})
			.on("mouseover", function(jb) {
				d3.select(this).attr("fill", function (d) { return d3.color(jobcolor(d)).brighter(.6); });
				jobtip.direction(calctipdirection(250, 300, "s", "e")).show(jb);
			})
			.on("mouseout", function(jb) {
				d3.select(this).attr("fill", function (d) { return jobcolor(d); })
				jobtip.hide(jb);
			})
			.on("click", function showjobinfo(jb) {
				var jobinfoel = d3.select(".jobinfo")
				jobinfoel.selectAll("table").remove();

				var table = jobinfoel.append("table").append("tbody");
				var tr = table.append("tr");
				tr.append("td").text("id");
				tr.append("td").text(jb["id"])
					.append("a")
							.attr("class", "copy-btn")
							.attr("href", "#")
							.attr("data-clipboard-text", jb["id"])
						.text("copy")
						.on("click", function(){ d3.event.preventDefault(); });

				if (clipboard) clipboard.destroy();
				clipboard = new Clipboard(document.querySelector(".copy-btn"));

				var keys = Object.keys(jb).sort();
				for (var i in keys) {
					var k = keys[i];
					if (k === "id") continue;
					var tr = table.append("tr")
					tr.append("td").text(k);
					tr.append("td").text(jb[k]);
				}

				jobinfomodal.toggle();
			});
			;
		jbs.exit().remove();

		// update all jobs colors
		d3.selectAll(".job")
			.attr("fill", function(d) { return jobcolor(d); });

		// draw all cpus every time
		counter = 0
		d3.select(this).selectAll(".job").selectAll("g").remove();
		var cores = d3.select(this).selectAll(".job").selectAll("g")
			.data(function (d) { var prev = counter; counter += (d["vnode_ncpus"] || 0); return d3.range(prev, counter); })
			;
		cores.enter().append("g")
				.attr("class", "core")
			.append("rect")
				.attr("width", 25)
				.attr("height", 25)
				.attr("x", function(d) { return ((counter-d-1) % cpuperrow(n)) * 25; })
				.attr("y", function(d) { return Math.floor((counter-d-1)/cpuperrow(n)) * 25; })
			;

		// STDIN jobs mark with S tags
		var stag = d3.select(this).selectAll(".job.stdin .core")
			.append("g")
				.attr("class", "stdin-tag")
				.attr("transform", function(d){ var x=((counter-d-1) % cpuperrow(n))*25+4; var y=Math.floor((counter-d-1)/cpuperrow(n))*25+5; return "translate(" + x + "," + y + ")"; })
			;
		stag.append("circle")
				.attr("fill", "white")
				.attr("cx", "2.5")
				.attr("cy", "2.5")
				.attr("r", "5")
			;
		stag.append("text")
				.attr("font-size", ".5em")
				.attr("x", ".3")
				.attr("y", "4.5")
				.attr("fill", "black")
				.attr("stroke", "black")
				.attr("font-weight", "100")
			.text("S");

		// interactive jobs mark with I tags
		var itag = d3.select(this).selectAll(".job.interactive .core")
			.append("g")
				.attr("class", "interactive-tag")
				.attr("transform", function(d){ var x=((counter-d-1) % cpuperrow(n))*25+16; var y=Math.floor((counter-d-1)/cpuperrow(n))*25+5; return "translate(" + x + "," + y + ")"; })
			;
		itag.append("circle")
				.attr("fill", "black")
				.attr("cx", "2.5")
				.attr("cy", "2.5")
				.attr("r", "5")
			;
		itag.append("text")
				.attr("font-size", ".5em")
				.attr("x", "1")
				.attr("y", "4.5")
				.attr("fill", "white")
				.attr("stroke", "white")
				.attr("font-weight", "100")
			.text("I");

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

// fetch the latest data from the server and update the display
function updatedisplay() {
	if (snapshot.isloaded) return;
	var q = d3.queue();

	var prefix = location.pathname;
	if (prefix[prefix.length-1] !== "/")
		prefix += '/';

	q.defer(d3.json, prefix + "jobs.json")
		.defer(d3.json, prefix + "nodes.json")
		.await(function(err, jobs, nodes) {
			if (err) return console.log(err);
			snapshot.current.jobs = jobs;
			snapshot.current.nodes = nodes;
			updatequeues(jobs);
			updatenodes(nodes, jobs);
		});
}

// update the alerts display
function updatealerts(alerts) {
	if (!alerts) return;
	var alertsdiv = d3.select(".alerts");
	alertsdiv.selectAll("table").remove();

	var table = alertsdiv.append("table").append("tbody");

	var tr = table.selectAll("tr")
		.data(alerts).enter()
		.append("tr");

	tr.append("td").text(function(alert){ return alert.time; });
	tr.append("td").html(function(alert){ return "<div class='color-box' style='background-color: " + usercolor(alert.user) + "'></div> " + alert.user});
	tr.append("td").attr("colspan", 4).text(function(alert){ return alert.msg; });
}

// returns the path prefix (i.e. /tamir/ or /)
function pathprefix() {
	var prefix = location.pathname;
	if (prefix[prefix.length-1] !== "/")
		prefix += '/';
	return prefix;
}

// fetch the latest alerts from the server
function fetchalerts() {
	if (snapshot.isloaded) return;
	var prefix = location.pathname;
	if (prefix[prefix.length-1] !== "/")
		prefix += '/';

	d3.json(prefix + "alerts.json", function(err, alerts) {
		if (err) return console.log(err);
		snapshot.current.alerts = alerts;
		updatealerts(alerts);
	});
}

// searches all jobs and all fields, and paints matched jobs in yellow
function searchjob() {
	var val = d3.event.target.value.toLowerCase();
	if (val === "") {
		d3.selectAll(".job")
			.classed("hit", false);
	} else {
		d3.selectAll(".job")
			.classed("hit", function(j){
				for (var key in j) {
					if (String(j[key]).toLowerCase().indexOf(val) >= 0) {
						return true;
					}
				}
				return false;
			});
	}
}

// create a modal from some element
function Modal(el) {
	d3.select(el).classed("show", false);
	d3.select(el).classed("modal", true);

	d3.select(el)
		.on("click", function(e) {
			d3.event.stopPropagation();
		});
	
	document.querySelector("body")
		.addEventListener("click", function(e) {
			d3.select(el).classed("show", false);
		});

	return {
		show: function() {
			d3.select(el).classed("show", true);
		},
		hide: function() {
			d3.select(el).classed("show", false);
		},
		toggle: function() {
			d3.select(el).classed("show", !d3.select(el).classed("show"));
			d3.event.preventDefault();
			d3.event.stopPropagation();
		}
	}
}

window.onload = function(e) {
	updatedisplay();
	setInterval(updatedisplay, 120000);

	setTimeout(fetchalerts, 3000);
	setInterval(fetchalerts, 300000);

	var alertsmodal = Modal(document.querySelector(".alerts"));
	jobinfomodal = Modal(document.querySelector(".jobinfo"));

	d3.select(".alertsbtn").on("click", alertsmodal.toggle);
	
	d3.select(".savesnapshotbtn").on("click", savesnapshot);
	d3.select("#loadsnapshot").on("change", loadsnapshot);

	d3.select("#search").on("input", searchjob);
}
