var queued_frames = [];
var selected_nodes = [];

function add_markers(svg)
{
	svg.append('svg:defs').append('svg:marker')
		.attr('id', 'red-arrow')
		.attr('viewBox', '0 -50 100 100')
		.attr('refX', 100)
		.attr('markerWidth', 25)
		.attr('markerHeight', 25)
		.attr('orient', 'auto')
		.style("fill", "red")
		.append('svg:path')
		.attr('d', 'M0,-10L37,0L0,10');

	svg.append('svg:defs').append('svg:marker')
		.attr('id', 'blue-arrow')
		.attr('viewBox', '0 -50 100 100')
		.attr('refX', 100)
		.attr('markerWidth', 25)
		.attr('markerHeight', 25)
		.attr('orient', 'auto')
		.style("fill", "blue")
		.append('svg:path')
		.attr('d', 'M0,-10L37,0L0,10');

	svg.append('svg:defs').append('svg:marker')
		.attr('id', 'black-arrow')
		.attr('viewBox', '0 -50 100 100')
		.attr('refX', 100)
		.attr('markerWidth', 25)
		.attr('markerHeight', 25)
		.attr('orient', 'auto')
		.style("fill", "black")
		.append('svg:path')
		.attr('d', 'M0,-10L37,0L0,10');
}

function get_id(x) { return x.id; }

function tick_graph(svg)
{
	svg.select("#links").selectAll(".link")
		.attr("x1", function(d) { return d.source.x; })
		.attr("y1", function(d) { return d.source.y; })
		.attr("x2", function(d) { return d.target.x; })
		.attr("y2", function(d) { return d.target.y; });

	svg.select("#nodes").selectAll(".node")
		.attr("cx", function(d) { return d.x; })
		.attr("cy", function(d) { return d.y; })
		.style("fill", function(d) {
				if (d.id == selected_node) return "lightgreen";
				return "white";
		});

	svg.select("#labels").selectAll(".link_label_group")
		.attr("transform", function(d) {
			return "translate(" +
				((d.source.x + d.target.x) / 2) + "," +
				((d.source.y + d.target.y) / 2) + ")";
		});

	svg.select("#labels").selectAll(".node_label_group")
		.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
}

function make_svg_graph_elems(svg, G, force)
{
	var node_shapes = svg.select("#nodes").selectAll(".node").data(G.nodes, get_id);
	var node_labels = svg.select("#labels").selectAll(".node_label_group").data(G.nodes, get_id);
	var link_shapes = svg.select("#links").selectAll(".link").data(G.links, get_id);
	var link_labels = svg.select("#labels").selectAll(".link_label_group").data(G.links, get_id);

	{
		var s = link_labels.enter().append('g')
			.attr("class", "link_label_group");
//			.on('mouseover', mouse_over_transition)
//			.on('mouseout', clear_info);

		s	.append("text")
			.attr("class", "link_label")
			.attr("y", function(d){
				return transitions[d.id].desc_lines.length > 1 ? -5 : 0; })
			.text(function(d){
				var l = transitions[d.id].desc_lines[0];
				return (l != "..." ? l : ""); });

		s	.append("text")
			.attr("class", "link_label")
			.attr("y", 13)
			.text(function(d){
				var l = transitions[d.id].desc_lines;
				return (l.length > 1 ? l[1] : ''); });
	}

	link_shapes.enter()
		.append("line")
		.attr("class", "link")
		.attr("marker-end", function(d){ return "url(#" + d.color + "-arrow)"; })
			// todo: can't we make a marker that inherits the line color?
		.style("stroke", function(d){ return d.color; });

	node_shapes.enter().append("circle")
		.attr("class", "node")
		.on('click', node_clicked)
		.on('mouseover', mouse_over_node)
//		.on('mouseout', clear_info)
		.call(force.drag);

	node_shapes.attr("r", function(d)
			{
				return selected_nodes.indexOf(d.id) == -1 ? 7 : 50;
			});

	node_shapes.style("stroke-width", function(d)
			{
				return (selected_nodes.indexOf(d.id) == -1 ? 1.5 : 2) + "px";
			});

	{
		var s = node_labels.enter().append("g")
			.attr("class", "node_label_group")
			.on('click', node_clicked)
			.on('mouseover', mouse_over_node)
//			.on('mouseout', clear_info)
			.call(force.drag);

		s	.append("text")
			.attr("class", "node_label")
			.text(function(d){return d.desc_lines[0];})
			.attr("y", function(d){return [5,-5,-12][d.desc_lines.length-1];});

		s	.append("text")
			.attr("class", "node_label")
			.text(function(d){return d.desc_lines.length > 1 ? d.desc_lines[1] : '';})
			.attr("y", function(d){return [0,17,7][d.desc_lines.length-1];});

		s	.append("text")
			.attr("class", "node_label")
			.text(function(d){return d.desc_lines.length > 2 ? d.desc_lines[2] : '';})
			.attr("y", 26);
	}

	node_shapes.exit().remove();
	node_labels.exit().remove();
	link_shapes.exit().remove();
	link_labels.exit().remove();
}

function try_move(candidate)
{
	var foundit = false;

	var n = nodes[selected_node];

	function queue_frame(f, frameid)
	{
		if (queued_frames.length >= 2 && queued_frames[queued_frames.length - 2][1] == frameid)
		{
			queued_frames.pop();
			queued_frames.pop();
		}

		queued_frames.push([f, frameid]);
	}

	n.outgoing.forEach(function(s)
		{
			var t = transitions[s.transition];
			if (!foundit && !s.reverse && step_to(s).node == candidate)
			{
				foundit = true;

				reo = compose_reo(inverse_reo(step_from(s).reo), reo);

				for (var i = 1; i != t.frames.length; ++i)
					queue_frame(apply_reo(reo, t.frames[i]), s.transition * 100 + i);

				reo = compose_reo(step_to(s).reo, reo);

				selected_node = candidate;
			}
		});

	n.incoming.forEach(function(s)
		{
			var t = transitions[s.transition];
			if (!foundit && !s.reverse && step_from(s).node == candidate)
			{
				foundit = true;

				reo = compose_reo(inverse_reo(step_to(s).reo), reo);

				for (var i = t.frames.length - 1; i != 0; --i)
					queue_frame(apply_reo(reo, t.frames[i - 1]), s.transition * 100 + (i - 1));

				reo = compose_reo(step_from(s).reo, reo);

				selected_node = candidate;
			}
		});

	return foundit;
}

function tick()
{
	if (queued_frames.length != 0)
	{
		kf += Math.max(0.1, Math.pow(queued_frames.length, 1.5) / 500);

		if (kf < 1)
		{
			targetpos = interpolate_position(last_keyframe, queued_frames[0][0], kf);
		}
		else
		{
			kf = 0;
			targetpos = last_keyframe = queued_frames.shift()[0];
		}
	}

	if (targetpos)
		thepos = (thepos ? interpolate_position(thepos, targetpos, drag) : targetpos);

	var center = thepos[0][Core].add(thepos[1][Core]).scale(0.5);
	center.y = Math.max(0, center.y - 0.5);

	var tgt = externalCamera.target;
	var vspeed = (center.y > tgt.y ? 0.05 : 0.005);

	tgt.x = center.x * 0.005 + tgt.x * 0.995;
	tgt.z = center.z * 0.005 + tgt.z * 0.995;
	tgt.y = center.y * vspeed + tgt.y * (1 - vspeed);

	// todo: base on elapsed time like composer does

	updateCamera();
}

function make_graph()
{
	svg = d3.select("#mynetwork");
	add_markers(svg);

	force = d3.layout.force()
		.charge(function(d)
			{
				if (selected_nodes.indexOf(d.id) != -1)
					return -1000;
				return -300;
				// todo: if this is not cached, cache it
			})
		.gravity(0.01)
		.linkDistance(200)
		.size([document.body.clientWidth, document.body.clientHeight]);

	svg.on("mouseup", function(){ force.alpha(0.01); });

	force.on("tick", function(){ tick_graph(svg); });
}

function makeScene(initialPos)
{
	scene = new BABYLON.Scene(engine);
	scene.clearColor = new BABYLON.Color3(1,1,1);

	externalCamera = new BABYLON.ArcRotateCamera("ArcRotateCamera",
		0, // rotation around Y axis
		3.14/4, // rotation around X axis
		2.5, // radius
		new BABYLON.Vector3(0, 0, 0), // target
		scene);

	externalCamera.wheelPrecision = 30;
	externalCamera.lowerBetaLimit = 0;
	externalCamera.upperRadiusLimit = 4;
	externalCamera.lowerRadiusLimit = 1;

	firstPersonCamera = new BABYLON.FreeCamera("FreeCamera", new BABYLON.Vector3(0, 1, -5), scene);
	firstPersonCamera.minZ = 0.05;

	externalCamera.attachControl(canvas);

	var light = new BABYLON.HemisphericLight('light1', new BABYLON.Vector3(0,1,0), scene);

	var draw = animated_position_from_array(initialPos, scene);

	scene.registerBeforeRender(function(){
			tick();
			if (thepos) draw(thepos);
		});

	engine.runRenderLoop(function(){ scene.render(); });
}